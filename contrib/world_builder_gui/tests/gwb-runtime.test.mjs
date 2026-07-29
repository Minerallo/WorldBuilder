import test from "node:test";
import assert from "node:assert/strict";

import { GwbRuntime, validateResult } from "../gwb-runtime.mjs";

function validResult() {
  return {
    dimension: 2,
    compositionCount: 1,
    cells: [1, 0, 1],
    points: new Float64Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1]),
    connectivity: new Uint32Array([0, 1, 2, 3]),
    depthWrtSurface: new Float64Array(4),
    depthWrtReference: new Float64Array(4),
    topography: new Float64Array(4),
    temperature: new Float64Array([1600, 1601, 1602, 1603]),
    velocity: new Float64Array(12),
    tags: new Int32Array(4),
    density: new Float64Array(0),
    composition: new Float64Array(4)
  };
}

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.terminated = false;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  postMessage(message) {
    this.message = message;
  }

  emit(type, data) {
    this.listeners.get(type)?.({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

test("validates a consistent typed-array result", () => {
  assert.equal(validateResult(validResult()).temperature[2], 1602);
  assert.throws(
    () => validateResult({
      ...validResult(),
      temperature: new Float64Array(1)
    }),
    /inconsistent point-data/
  );
});

test("runs one browser calculation and forwards progress", async () => {
  const worker = new FakeWorker();
  const runtime = new GwbRuntime({ workerFactory: () => worker });
  const progress = [];
  const pending = runtime.run({
    wbText: "{\"version\":\"1.0\"}",
    gridText: "grid_type = cartesian",
    resolutionLimit: 32
  }, {
    onProgress: update => progress.push(update)
  });

  const id = worker.message.id;
  worker.emit("message", {
    type: "progress", id, phase: "sampling", progress: 0.25
  });
  worker.emit("message", { type: "result", id, result: validResult() });

  const result = await pending;
  assert.equal(result.points.length, 12);
  assert.deepEqual(progress, [{ phase: "sampling", progress: 0.25 }]);
  assert.equal(runtime.busy, false);
});

test("aborting terminates the active worker and permits a fresh run", async () => {
  const workers = [];
  const runtime = new GwbRuntime({
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    }
  });
  const controller = new AbortController();
  const pending = runtime.run({
    wbText: "{}",
    gridText: "grid_type = cartesian"
  }, { signal: controller.signal });

  controller.abort();
  await assert.rejects(pending, /abort/i);
  assert.equal(workers[0].terminated, true);
  assert.equal(runtime.busy, false);
});
