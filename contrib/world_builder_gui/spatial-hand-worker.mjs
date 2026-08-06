let handLandmarker = null;

async function initialize({ wasmRoot, modelUrl }) {
  const { FilesetResolver, HandLandmarker } = await import("/vendor/mediapipe/vision_bundle.mjs");
  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath:modelUrl },
    runningMode:"VIDEO",
    numHands:2,
    minHandDetectionConfidence:.55,
    minHandPresenceConfidence:.5,
    minTrackingConfidence:.5
  });
  self.postMessage({ type:"ready" });
}

self.addEventListener("message", async event => {
  const message = event.data || {};
  try {
    if (message.type === "init") {
      await initialize(message);
      return;
    }
    if (message.type === "frame" && handLandmarker) {
      const result = handLandmarker.detectForVideo(message.bitmap,message.timestamp);
      message.bitmap.close();
      const hands = (result.landmarks || []).map((landmarks,index) => ({
        landmarks,
        worldLandmarks:result.worldLandmarks?.[index] || [],
        handedness:result.handedness?.[index]?.[0]?.categoryName || `Hand ${index+1}`,
        confidence:Number(result.handedness?.[index]?.[0]?.score || 0)
      }));
      self.postMessage({ type:"result",timestamp:message.timestamp,hands });
    }
  } catch (error) {
    message.bitmap?.close?.();
    self.postMessage({ type:"error",message:error?.message || String(error) });
  }
});

self.addEventListener("close", () => handLandmarker?.close?.());
