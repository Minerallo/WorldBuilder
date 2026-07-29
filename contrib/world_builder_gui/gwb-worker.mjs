let modulePromise;
let session;

function transferables(result) {
  return [
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
}

async function loadModule() {
  if (!modulePromise) {
    modulePromise = import("./wasm/gwb-web.js")
      .then(({ default: createGwbModule }) => createGwbModule());
  }
  return modulePromise;
}

async function run({ id, wbText, gridText, resolutionLimit }) {
  self.postMessage({ type: "progress", id, phase: "loading", progress: 0.05 });
  const module = await loadModule();

  self.postMessage({ type: "progress", id, phase: "parsing", progress: 0.15 });
  session?.delete();
  session = new module.BrowserSession(wbText);

  self.postMessage({ type: "progress", id, phase: "sampling", progress: 0.25 });
  const result = session.sampleGrid(gridText, resolutionLimit);

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
