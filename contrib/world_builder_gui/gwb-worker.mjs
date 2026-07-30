let modulePromise;
let session;

function transferables(result) {
  const buffers = [
    result.points.buffer,
    result.connectivity.buffer,
    result.depthWrtSurface.buffer,
    result.depthWrtReference.buffer,
    result.topography.buffer,
    result.temperature.buffer,
    result.velocity.buffer,
    result.tags.buffer,
    result.density.buffer,
    result.composition.buffer
  ];
  if (result.adaptive) {
    buffers.push(result.cellBounds.buffer, result.cellLevels.buffer);
  }
  return buffers;
}

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import("./wasm/gwb-web.js")
      .then(({ default: createGwbModule }) => createGwbModule());
  }
  return modulePromise;
}

async function run({
  id,
  wbText,
  gridText,
  resolutionLimit,
  sampling = "uniform",
  adaptive
}) {
  self.postMessage({ type: "progress", id, phase: "loading", progress: 0.05 });
  const module = await loadModule();

  self.postMessage({ type: "progress", id, phase: "parsing", progress: 0.15 });
  session?.delete();
  session = null;
  session = new module.BrowserSession(wbText);

  self.postMessage({ type: "progress", id, phase: "sampling", progress: 0.25 });
  const result = sampling === "adaptive"
    ? session.sampleAdaptiveGrid(
      gridText,
      resolutionLimit,
      adaptive.baseResolution,
      adaptive.maxDepth,
      adaptive.maxCells,
      adaptive.temperatureTolerance,
      adaptive.compositionTolerance,
      adaptive.topographyTolerance
    )
    : session.sampleGrid(gridText, resolutionLimit);

  self.postMessage({ type: "progress", id, phase: "transferring", progress: 0.95 });
  self.postMessage({ type: "result", id, result }, transferables(result));
}

self.addEventListener("message", event => {
  if (event.data?.type !== "run") return;
  run(event.data).catch(error => {
    self.postMessage({
      type: "error",
      id: event.data.id,
      message: error?.message || String(error),
      stack: error?.stack || ""
    });
  });
});

self.addEventListener("close", () => session?.delete());
