import test from "node:test";
import assert from "node:assert/strict";
import { buildAspectAscii, buildAspectCompositionContours } from "../aspect-ascii.mjs";

const settings = { coordinateSystem: "cartesian", dimension: 2, xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10, cellsX: 1, cellsY: 1, cellsZ: 1, compositions: 2, mantleTemperature: 1600 };
const feature = { id: "a", name: "plate", model: "continental plate", points: [[-1,-1],[11,-1],[11,11],[-1,11]], minDepth: 0, maxDepth: 6, temperature: 900, composition: 1, layers: [] };

test("writes ASPECT 2D structured ASCII with x ascending first", () => {
  const text = buildAspectAscii(settings, [feature], { dimension: 2, nx: 2, nz: 2 });
  assert.match(text, /# POINTS: 2 2/);
  const data = text.split("\n").filter(line => line && !line.startsWith("#"));
  assert.equal(data.length, 4);
  assert.equal(Number(data[0].split(/\s+/)[0]), 0);
  assert.equal(Number(data[1].split(/\s+/)[0]), 10);
  assert.deepEqual(data.at(-1).split(/\s+/).slice(-2).map(Number), [0, 1]);
});

test("writes spherical 3D coordinates as r phi theta", () => {
  const text = buildAspectAscii({ ...settings, coordinateSystem: "spherical", dimension: 3, radius: 100, xMin: 0, xMax: 10, yMin: 0, yMax: 10 }, [], { nx: 2, ny: 2, nz: 2, temperature: true, composition: false });
  assert.match(text, /# POINTS: 2 2 2/);
  assert.match(text, /r phi theta/);
});

test("composition contour export preserves layer depth intervals and vertices", () => {
  const text = buildAspectCompositionContours([{ ...feature, layers: [{ name: "crust", composition: 2, minDepth: 0, maxDepth: 5 }] }]);
  assert.match(text, /"crust" 0 5/);
  assert.match(text, /"plate" 2/);
});
