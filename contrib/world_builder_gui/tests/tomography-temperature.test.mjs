import test from "node:test";
import assert from "node:assert/strict";
import { convertTomographyToTemperature } from "../tomography-temperature.mjs";

test("ASPECT scaling maps positive dVs to a colder anomaly", () => {
  const result = convertTomographyToTemperature([1, -1], { removeMean: false });
  assert.ok(Math.abs(result.anomaly[0] + 125) < 1e-10);
  assert.ok(Math.abs(result.anomaly[1] - 125) < 1e-10);
  assert.ok(Math.abs(result.temperature[0] - 1475) < 1e-10);
});

test("lateral mean removal centers tomography temperature", () => {
  const result = convertTomographyToTemperature([1, 2, 3]);
  assert.equal(result.temperature.reduce((sum, value) => sum + value, 0) / 3, 1600);
});

test("dVp is converted through the configurable dVs/dVp ratio", () => {
  const result = convertTomographyToTemperature([1], { sourceField: "dvp", dvsDvpRatio: 2, removeMean: false });
  assert.ok(Math.abs(result.anomaly[0] + 250) < 1e-10);
});

test("shallow cutoff suppresses and clipping bounds anomalies", () => {
  assert.equal(convertTomographyToTemperature([10], { removeMean: false, maxAbsAnomaly: 100 }).anomaly[0], -100);
  assert.equal(convertTomographyToTemperature([10], { removeMean: false, depthKm: 20, shallowCutoffKm: 50 }).anomaly[0], 0);
});
