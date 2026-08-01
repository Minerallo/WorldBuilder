const SECONDS_PER_YEAR = 365.25 * 24 * 3600;

const arrayField = (value, size, fallback) => {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    if (value.length !== size) throw new Error(`Thermal field has ${value.length} values; expected ${size}.`);
    return Float64Array.from(value, item => Number(item));
  }
  return new Float64Array(size).fill(Number.isFinite(Number(value)) ? Number(value) : fallback);
};

function applyBoundaries(temperature, options, conductivity, nx, nz, dz) {
  const top = Number(options.topTemperature);
  for (let x = 0; x < nx; x++) temperature[x] = top;
  for (let z = 0; z < nz; z++) {
    temperature[z * nx] = temperature[z * nx + 1];
    temperature[z * nx + nx - 1] = temperature[z * nx + nx - 2];
  }
  const bottomOffset = (nz - 1) * nx;
  if (options.bottomMode === "flux") {
    const flux = Number(options.bottomHeatFlux);
    for (let x = 0; x < nx; x++) {
      const index = bottomOffset + x;
      temperature[index] = temperature[index - nx] + flux * dz / Math.max(1e-12, conductivity[index]);
    }
  } else {
    const bottom = Number(options.bottomTemperature);
    for (let x = 0; x < nx; x++) temperature[bottomOffset + x] = bottom;
  }
}

function prepare(options) {
  const nx = Math.max(4, Math.round(Number(options.nx) || 48));
  const nz = Math.max(4, Math.round(Number(options.nz) || 36));
  const width = Math.max(1, Number(options.width));
  const depth = Math.max(1, Number(options.depth));
  const size = nx * nz;
  const conductivity = arrayField(options.conductivity, size, 3);
  const heatProduction = arrayField(options.heatProduction, size, 0);
  const density = arrayField(options.density, size, 2800);
  const heatCapacity = arrayField(options.heatCapacity, size, 1000);
  const dx = width / (nx - 1); const dz = depth / (nz - 1);
  const temperature = new Float64Array(size);
  const top = Number(options.topTemperature); const bottom = Number(options.bottomTemperature);
  for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) temperature[z * nx + x] = top + (bottom - top) * z / (nz - 1);
  applyBoundaries(temperature, options, conductivity, nx, nz, dz);
  return { nx, nz, size, width, depth, conductivity, heatProduction, density, heatCapacity, dx, dz, temperature };
}

export function solveSteadyConduction(options) {
  const model = prepare(options);
  const { nx, nz, conductivity: k, heatProduction: h, dx, dz, temperature: t } = model;
  const maxIterations = Math.max(10, Math.round(Number(options.maxIterations) || 5000));
  const tolerance = Math.max(1e-8, Number(options.tolerance) || 1e-3);
  const omega = Math.max(1, Math.min(1.92, Number(options.relaxation) || 1.65));
  let residual = Infinity; let iteration = 0;
  for (; iteration < maxIterations && residual > tolerance; iteration++) {
    residual = 0;
    for (let z = 1; z < nz - 1; z++) for (let x = 1; x < nx - 1; x++) {
      const i = z * nx + x;
      const ke = 2 * k[i] * k[i + 1] / Math.max(1e-12, k[i] + k[i + 1]) / (dx * dx);
      const kw = 2 * k[i] * k[i - 1] / Math.max(1e-12, k[i] + k[i - 1]) / (dx * dx);
      const ks = 2 * k[i] * k[i + nx] / Math.max(1e-12, k[i] + k[i + nx]) / (dz * dz);
      const kn = 2 * k[i] * k[i - nx] / Math.max(1e-12, k[i] + k[i - nx]) / (dz * dz);
      const candidate = (ke * t[i + 1] + kw * t[i - 1] + ks * t[i + nx] + kn * t[i - nx] + h[i]) / (ke + kw + ks + kn);
      const change = omega * (candidate - t[i]);
      t[i] += change; residual = Math.max(residual, Math.abs(change));
    }
    applyBoundaries(t, options, k, nx, nz, dz);
  }
  return { ...model, temperature: t, iterations: iteration, residual, converged: residual <= tolerance, mode: "steady" };
}

export function solveTransientConduction(options) {
  const model = prepare(options);
  const { nx, nz, conductivity: k, heatProduction: h, density, heatCapacity, dx, dz, temperature: t } = model;
  const targetSeconds = Math.max(0, Number(options.timeYears) || 0) * SECONDS_PER_YEAR;
  const maximumDiffusivity = Math.max(...k.map((value, index) => value / Math.max(1, density[index] * heatCapacity[index])));
  const stableStep = .42 / (2 * maximumDiffusivity * (1 / (dx * dx) + 1 / (dz * dz)));
  const requestedSteps = Math.max(1, Math.ceil(targetSeconds / stableStep));
  const steps = Math.min(Math.max(1, Math.round(Number(options.maxTimeSteps) || 4000)), requestedSteps);
  const dt = targetSeconds / steps;
  let current = t; let next = new Float64Array(current);
  for (let step = 0; step < steps; step++) {
    for (let z = 1; z < nz - 1; z++) for (let x = 1; x < nx - 1; x++) {
      const i = z * nx + x;
      const laplacian = k[i] * ((current[i + 1] - 2 * current[i] + current[i - 1]) / (dx * dx)
        + (current[i + nx] - 2 * current[i] + current[i - nx]) / (dz * dz));
      next[i] = current[i] + dt * (laplacian + h[i]) / Math.max(1, density[i] * heatCapacity[i]);
    }
    applyBoundaries(next, options, k, nx, nz, dz);
    [current, next] = [next, current];
  }
  return { ...model, temperature: current, iterations: steps, residual: 0, converged: true, mode: "transient", simulatedYears: targetSeconds / SECONDS_PER_YEAR, timeStepYears: dt / SECONDS_PER_YEAR };
}

export function analyticalSteadyGeotherm({ depth, topTemperature, bottomTemperature, conductivity, heatProduction }, z) {
  const ratio = z / depth;
  return topTemperature + (bottomTemperature - topTemperature) * ratio
    + heatProduction / (2 * conductivity) * z * (depth - z);
}
