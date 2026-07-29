const ARRAY_FIELDS = [
  "points", "connectivity", "depthWrtSurface", "depthWrtReference",
  "topography", "temperature", "velocity", "tags", "density", "composition"
];

export class GwbRuntime {
  constructor({
    workerUrl = new URL("./gwb-worker.mjs", import.meta.url),
    workerFactory = url => new Worker(url, { type: "module" })
  } = {}) {
    this.workerUrl = workerUrl;
    this.workerFactory = workerFactory;
    this.nextId = 1;
    this.active = null;
    this.worker = null;
  }

  get busy() {
    return this.active !== null;
  }

  run({ wbText, gridText, resolutionLimit = 256 }, {
    signal,
    onProgress = () => {}
  } = {}) {
    if (typeof wbText !== "string" || !wbText.trim()) {
      return Promise.reject(new TypeError("wbText must contain a World Builder model."));
    }
    if (typeof gridText !== "string" || !gridText.trim()) {
      return Promise.reject(new TypeError("gridText must contain a gwb-grid configuration."));
    }
    if (!Number.isInteger(resolutionLimit) || resolutionLimit < 1) {
      return Promise.reject(new TypeError("resolutionLimit must be a positive integer."));
    }
    if (this.busy) {
      return Promise.reject(new Error("A GWB browser calculation is already running."));
    }
    if (signal?.aborted) {
      return Promise.reject(signal.reason || new DOMException("Aborted", "AbortError"));
    }

    this.ensureWorker();
    const id = this.nextId++;

    return new Promise((resolve, reject) => {
      const abort = () => {
        const reason = signal.reason || new DOMException("Aborted", "AbortError");
        this.resetWorker(reason);
      };
      signal?.addEventListener("abort", abort, { once: true });

      this.active = {
        id, resolve, reject, onProgress,
        cleanup: () => signal?.removeEventListener("abort", abort)
      };
      this.worker.postMessage({
        type: "run", id, wbText, gridText, resolutionLimit
      });
    });
  }

  dispose() {
    this.resetWorker(new Error("The GWB browser runtime was disposed."));
  }

  ensureWorker() {
    if (this.worker) return;
    this.worker = this.workerFactory(this.workerUrl);
    this.worker.addEventListener("message", event => this.handleMessage(event.data));
    this.worker.addEventListener("error", event => {
      this.resetWorker(new Error(event.message || "The GWB worker failed."));
    });
  }

  handleMessage(message) {
    if (!this.active || message?.id !== this.active.id) return;
    if (message.type === "progress") {
      this.active.onProgress({
        phase: message.phase,
        progress: Number(message.progress) || 0
      });
      return;
    }

    const active = this.active;
    this.active = null;
    active.cleanup();

    if (message.type === "error") {
      active.reject(new Error(message.message || "GWB calculation failed."));
      return;
    }
    if (message.type !== "result") {
      active.reject(new Error("The GWB worker returned an unknown response."));
      return;
    }

    try {
      active.resolve(validateResult(message.result));
    } catch (error) {
      active.reject(error);
    }
  }

  resetWorker(reason) {
    this.worker?.terminate();
    this.worker = null;
    if (this.active) {
      const active = this.active;
      this.active = null;
      active.cleanup();
      active.reject(reason);
    }
  }
}

export function validateResult(result) {
  if (!result || ![2, 3].includes(result.dimension)) {
    throw new TypeError("GWB returned an invalid grid dimension.");
  }
  if (!Array.isArray(result.cells) || result.cells.length !== 3) {
    throw new TypeError("GWB returned invalid grid cell metadata.");
  }
  for (const field of ARRAY_FIELDS) {
    if (!ArrayBuffer.isView(result[field])) {
      throw new TypeError(`GWB returned an invalid ${field} array.`);
    }
  }
  const pointCount = result.points.length / 3;
  if (!Number.isInteger(pointCount) ||
      result.temperature.length !== pointCount ||
      result.topography.length !== pointCount ||
      result.tags.length !== pointCount ||
      result.velocity.length !== pointCount * 3) {
    throw new TypeError("GWB returned inconsistent point-data lengths.");
  }
  if (result.composition.length !== pointCount * result.compositionCount) {
    throw new TypeError("GWB returned inconsistent composition data.");
  }
  return result;
}

export const gwbRuntime = new GwbRuntime();
