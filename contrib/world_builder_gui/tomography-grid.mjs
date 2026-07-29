import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MODEL_FILES = {
  model_s20rts: "S20RTS.sph",
  model_s40rts: "S40RTS.sph"
};
const MODEL_CACHE = new Map();
const EARTH_RADIUS_KM = 6371;
const CMB_RADIUS_KM = 3480;
const MOHO_RADIUS_KM = 6346;

export function parseSphericalHarmonics(text) {
  const lines = String(text).trim().split(/\r?\n/);
  const order = Number(lines.shift()?.trim().split(/\s+/)[0]);
  if (!Number.isInteger(order) || order < 0 || order > 128) throw new Error("Invalid spherical-harmonic order.");
  const numbers = lines.join(" ").match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[EeDd][+-]?\d+)?/g)
    ?.map(value => Number(value.replace(/[Dd]/g, "E"))) || [];
  const layerSize = (order + 1) ** 2;
  if (numbers.length % layerSize !== 0) throw new Error("The spherical-harmonic coefficient file is incomplete.");
  const layerCount = numbers.length / layerSize;
  const harmonicCount = (order + 1) * (order + 2) / 2;
  const cosine = Array.from({ length: layerCount }, () => new Float64Array(harmonicCount));
  const sine = Array.from({ length: layerCount }, () => new Float64Array(harmonicCount));
  let cursor = 0;
  for (let layer = 0; layer < layerCount; layer++) {
    let harmonic = 0;
    for (let degree = 0; degree <= order; degree++) {
      for (let azimuthal = 0; azimuthal <= degree; azimuthal++, harmonic++) {
        cosine[layer][harmonic] = numbers[cursor++];
        if (azimuthal > 0) sine[layer][harmonic] = numbers[cursor++];
      }
    }
  }
  return { order, layerCount, harmonicCount, cosine, sine };
}

function naturalSplineAt(xs, ys, requestedX) {
  const count = xs.length;
  if (requestedX <= xs[0]) return ys[0];
  if (requestedX >= xs[count - 1]) return ys[count - 1];
  const second = new Float64Array(count);
  const working = new Float64Array(count - 1);
  for (let index = 1; index < count - 1; index++) {
    const sigma = (xs[index] - xs[index - 1]) / (xs[index + 1] - xs[index - 1]);
    const pivot = sigma * second[index - 1] + 2;
    second[index] = (sigma - 1) / pivot;
    working[index] = (6 * (
      (ys[index + 1] - ys[index]) / (xs[index + 1] - xs[index])
      - (ys[index] - ys[index - 1]) / (xs[index] - xs[index - 1])
    ) / (xs[index + 1] - xs[index - 1]) - sigma * working[index - 1]) / pivot;
  }
  for (let index = count - 2; index >= 0; index--) second[index] = second[index] * second[index + 1] + working[index];
  let low = 0; let high = count - 1;
  while (high - low > 1) {
    const middle = Math.floor((high + low) / 2);
    if (xs[middle] > requestedX) high = middle;
    else low = middle;
  }
  const width = xs[high] - xs[low];
  const a = (xs[high] - requestedX) / width;
  const b = (requestedX - xs[low]) / width;
  return a * ys[low] + b * ys[high]
    + ((a ** 3 - a) * second[low] + (b ** 3 - b) * second[high]) * width ** 2 / 6;
}

function interpolateAtDepth(model, knots, depth) {
  const radii = knots.map(knot => CMB_RADIUS_KM + (MOHO_RADIUS_KM - CMB_RADIUS_KM) * 0.5 * (knot + 1));
  const radius = EARTH_RADIUS_KM - depth;
  const cosine = new Float64Array(model.harmonicCount);
  const sine = new Float64Array(model.harmonicCount);
  const values = new Float64Array(model.layerCount);
  for (let harmonic = 0; harmonic < model.harmonicCount; harmonic++) {
    for (let layer = 0; layer < model.layerCount; layer++) values[layer] = model.cosine[model.layerCount - 1 - layer][harmonic];
    cosine[harmonic] = naturalSplineAt(radii, values, radius);
    for (let layer = 0; layer < model.layerCount; layer++) values[layer] = model.sine[model.layerCount - 1 - layer][harmonic];
    sine[harmonic] = naturalSplineAt(radii, values, radius);
  }
  return { cosine, sine };
}

function logFactorial(value) {
  let result = 0;
  for (let number = 2; number <= value; number++) result += Math.log(number);
  return result;
}

function harmonicBasis(order, latitude) {
  const x = Math.sin(latitude * Math.PI / 180);
  const count = (order + 1) * (order + 2) / 2;
  const basis = new Float64Array(count);
  const p = Array.from({ length: order + 1 }, () => new Float64Array(order + 1));
  p[0][0] = 1;
  const root = Math.sqrt(Math.max(0, 1 - x * x));
  for (let m = 1; m <= order; m++) p[m][m] = -(2 * m - 1) * root * p[m - 1][m - 1];
  for (let m = 0; m < order; m++) p[m + 1][m] = (2 * m + 1) * x * p[m][m];
  for (let m = 0; m <= order; m++) {
    for (let l = m + 2; l <= order; l++) {
      p[l][m] = ((2 * l - 1) * x * p[l - 1][m] - (l + m - 1) * p[l - 2][m]) / (l - m);
    }
  }
  let harmonic = 0;
  for (let l = 0; l <= order; l++) {
    for (let m = 0; m <= l; m++, harmonic++) {
      const normalization = Math.sqrt((2 * l + 1) / (4 * Math.PI)
        * Math.exp(logFactorial(l - m) - logFactorial(l + m)));
      basis[harmonic] = normalization * p[l][m];
    }
  }
  return basis;
}

function evaluateGrid(model, coefficients, bounds, nx, ny) {
  const values = new Array(nx * ny);
  let minimum = Infinity; let maximum = -Infinity;
  const latitudes = Array.from({ length: ny }, (_, row) =>
    bounds.north - row / Math.max(1, ny - 1) * (bounds.north - bounds.south));
  const bases = latitudes.map(latitude => harmonicBasis(model.order, latitude));
  const trig = Array.from({ length: nx }, (_, column) => {
    const longitude = bounds.west + column / Math.max(1, nx - 1) * (bounds.east - bounds.west);
    const radians = longitude * Math.PI / 180;
    return {
      cosine: Float64Array.from({ length: model.order + 1 }, (_, m) => Math.cos(m * radians)),
      sine: Float64Array.from({ length: model.order + 1 }, (_, m) => Math.sin(m * radians))
    };
  });
  for (let row = 0; row < ny; row++) {
    for (let column = 0; column < nx; column++) {
      let value = 0; let harmonic = 0;
      for (let l = 0; l <= model.order; l++) {
        for (let m = 0; m <= l; m++, harmonic++) {
          value += bases[row][harmonic] * (
            coefficients.cosine[harmonic] * trig[column].cosine[m]
            + coefficients.sine[harmonic] * trig[column].sine[m]
          );
        }
      }
      value *= 100;
      values[row * nx + column] = Number(value.toFixed(6));
      minimum = Math.min(minimum, value);
      maximum = Math.max(maximum, value);
    }
  }
  return { values, min: minimum, max: maximum };
}

export async function loadSphericalTomographyGrid({
  model: modelName, depth, west, east, south, north, nx = 101, ny = 81, dataDirectory
}) {
  const filename = MODEL_FILES[modelName];
  if (!filename) throw new Error("This SubMachine model does not expose a numerical grid through the current public service.");
  const cacheKey = `${dataDirectory}/${filename}`;
  let model = MODEL_CACHE.get(cacheKey);
  if (!model) {
    model = parseSphericalHarmonics(await readFile(join(dataDirectory, filename), "utf8"));
    const knotText = await readFile(join(dataDirectory, "Spline_knots.txt"), "utf8");
    model.knots = (knotText.match(/^[+-]?\d+\.\d+/gm) || []).map(Number);
    if (model.knots.length !== model.layerCount) throw new Error("Spline knots do not match the tomography layers.");
    MODEL_CACHE.set(cacheKey, model);
  }
  nx = Math.max(16, Math.min(181, Math.round(Number(nx) || 101)));
  ny = Math.max(12, Math.min(121, Math.round(Number(ny) || 81)));
  const bounds = { west: Number(west), east: Number(east), south: Number(south), north: Number(north) };
  const coefficients = interpolateAtDepth(model, model.knots, Number(depth));
  const grid = evaluateGrid(model, coefficients, bounds, nx, ny);
  return {
    model: modelName, depth: Number(depth), unit: "dVs (%)", nx, ny, ...bounds, ...grid,
    source: "ASPECT bundled S20RTS/S40RTS spherical-harmonic coefficients",
    numerical: true
  };
}

