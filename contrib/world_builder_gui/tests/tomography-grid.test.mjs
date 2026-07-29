import test from "node:test";
import assert from "node:assert/strict";
import { parseSphericalHarmonics } from "../tomography-grid.mjs";

test("parses layered real spherical-harmonic coefficients", () => {
  const layers = Array.from({ length: 21 }, (_, layer) =>
    [layer + 1, layer + 2, layer + 3, layer + 4].join(" ")
  ).join("\n");
  const model = parseSphericalHarmonics(`1 metadata\n${layers}`);
  assert.equal(model.order, 1);
  assert.equal(model.layerCount, 21);
  assert.equal(model.harmonicCount, 3);
  assert.deepEqual([...model.cosine[0]], [1, 2, 3]);
  assert.deepEqual([...model.sine[0]], [0, 0, 4]);
  assert.deepEqual([...model.cosine[20]], [21, 22, 23]);
});

test("rejects incomplete coefficient layers", () => {
  assert.throws(() => parseSphericalHarmonics("1\n1 2 3"), /incomplete/);
});

