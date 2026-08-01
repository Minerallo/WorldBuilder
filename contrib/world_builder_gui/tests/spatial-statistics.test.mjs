import test from "node:test";
import assert from "node:assert/strict";
import { pairedStatistics, moransI, pointPatternMisfit } from "../spatial-statistics.mjs";

test("paired statistics report perfect agreement", () => {
  const result = pairedStatistics([1, 2, 3, 4], [1, 2, 3, 4]);
  assert.equal(result.count, 4);
  assert.equal(result.bias, 0);
  assert.equal(result.rmse, 0);
  assert.equal(result.pearson, 1);
  assert.equal(result.r2, 1);
});

test("paired statistics ignore non-finite pairs", () => {
  const result = pairedStatistics([1, NaN, 3], [2, 10, 5]);
  assert.equal(result.count, 2);
  assert.equal(result.bias, 1.5);
  assert.equal(result.mae, 1.5);
});

test("Moran's I distinguishes clustered and alternating grids", () => {
  const clustered = moransI([0,0,1, 0,0,1, 1,1,2], 3, 3);
  const alternating = moransI([0,1,0, 1,0,1, 0,1,0], 3, 3);
  assert.ok(clustered.value > clustered.expected);
  assert.ok(alternating.value < 0);
});

test("point pattern misfit reports bidirectional fit", () => {
  const result = pointPatternMisfit([[0, 0], [10, 0]], [{ x: 1, y: 0 }, { x: 9, y: 0 }], 2);
  assert.equal(result.observation.rmse, 1);
  assert.equal(result.prediction.rmse, 1);
  assert.equal(result.recall, 1);
  assert.equal(result.precision, 1);
  assert.equal(result.symmetricMean, 1);
});
