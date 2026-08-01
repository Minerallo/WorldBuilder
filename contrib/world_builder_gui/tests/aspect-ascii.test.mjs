import test from "node:test";
import assert from "node:assert/strict";
import { buildAspectAscii, buildAspectCompositionContours } from "../aspect-ascii.mjs";

const settings = { coordinateSystem: "cartesian", dimension: 2, xMin: 0, xMax: 10, yMin: 0, yMax: 10, zMin: 0, zMax: 10, cellsX: 1, cellsY: 1, cellsZ: 1, compositions: 2, mantleTemperature: 1600 };
const feature = { id: "a", name: "plate", model: "continental plate", points: [[-1,-1],[11,-1],[11,11],[-1,11]], minDepth: 0, maxDepth: 6, temperature: 900, composition: 1, layers: [] };
const dataRows = text => text.split("\n").filter(line => line && !line.startsWith("#")).map(line => line.trim().split(/\s+/).map(Number));

test("writes ASPECT 2D structured ASCII with x ascending first", () => {
  const text = buildAspectAscii(settings, [feature], { dimension: 2, nx: 2, nz: 2 });
  assert.match(text, /# POINTS: 2 2/);
  const data = text.split("\n").filter(line => line && !line.startsWith("#"));
  assert.equal(data.length, 4);
  assert.equal(Number(data[0].split(/\s+/)[0]), 0);
  assert.equal(Number(data[1].split(/\s+/)[0]), 10);
  assert.deepEqual(data.at(-1).split(/\s+/).slice(-2).map(Number), [0, 1]);
});

test("writes Cartesian 3D x-y-z grids with x fastest and complete scalar columns", () => {
  const text = buildAspectAscii({ ...settings, dimension: 3 }, [feature], { nx: 3, ny: 2, nz: 2, temperature: false, composition: true });
  assert.match(text, /# POINTS: 3 2 2/);
  assert.match(text, /# Columns: x y z composition_0 composition_1/);
  const rows = dataRows(text);
  assert.equal(rows.length, 12);
  assert.deepEqual(rows.slice(0, 3).map(row => row[0]), [0, 5, 10]);
  assert.ok(rows[3][1] > rows[0][1]);
  assert.ok(rows[6][2] > rows[0][2]);
});

test("writes spherical 2D grids as ascending r-phi coordinates", () => {
  const text = buildAspectAscii({ ...settings, coordinateSystem: "spherical", radius: 100 }, [], { dimension: 2, nx: 3, nz: 2, temperature: true, composition: false });
  assert.match(text, /# POINTS: 2 3/);
  assert.match(text, /# Columns: x y temperature/);
  assert.match(text, /r phi \(m, radians\)/);
  const rows = dataRows(text);
  assert.equal(rows.length, 6);
  assert.ok(rows[1][0] > rows[0][0]);
  assert.ok(rows[2][1] > rows[0][1]);
});

test("writes spherical 3D coordinates as ascending r phi theta", () => {
  const text = buildAspectAscii({ ...settings, coordinateSystem: "spherical", dimension: 3, radius: 100, xMin: 0, xMax: 10, yMin: -10, yMax: 10 }, [], { nx: 2, ny: 3, nz: 2, temperature: true, composition: false });
  assert.match(text, /# POINTS: 2 2 3/);
  assert.match(text, /r phi theta/);
  const rows = dataRows(text);
  assert.equal(rows.length, 12);
  assert.ok(rows[1][0] > rows[0][0], "r ascends fastest");
  assert.ok(rows[2][1] > rows[0][1], "phi ascends second");
  assert.ok(rows[4][2] > rows[0][2], "theta ascends last");
});

test("automatically includes every composition index used by sublayers", () => {
  const layered = { ...feature, layers: [{ name: "deep", composition: 4, minDepth: 0, maxDepth: 10 }] };
  const text = buildAspectAscii(settings, [layered], { nx: 2, nz: 2, temperature: false, composition: true });
  assert.match(text, /composition_0 composition_1 composition_2 composition_3 composition_4/);
});

test("composition contour export preserves layer depth intervals and vertices", () => {
  const text = buildAspectCompositionContours([{ ...feature, layers: [{ name: "crust", composition: 2, minDepth: 0, maxDepth: 5 }] }]);
  assert.match(text, /"crust" 0 5/);
  assert.match(text, /"plate" 2/);
});
