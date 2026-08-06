import { HAND_CONNECTIONS, SpatialGestureTracker } from "./spatial-engine.mjs";

export class SpatialControls {
  constructor({ video,overlay,onFrame,onStatus }) {
    this.video=video; this.overlay=overlay; this.context=overlay.getContext("2d");
    this.onFrame=onFrame; this.onStatus=onStatus;
    this.tracker=new SpatialGestureTracker();
    this.worker=null; this.stream=null; this.running=false; this.workerReady=false; this.processing=false;
    this.showSkeleton=true; this.frameRate=20; this.lastFrameAt=0;
  }

  configure(options={}) {
    this.tracker.configure(options);
    if (options.showSkeleton != null) this.showSkeleton=Boolean(options.showSkeleton);
    if (options.frameRate != null) this.frameRate=Math.max(8,Math.min(30,Number(options.frameRate)));
  }

  async cameras() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter(device=>device.kind==="videoinput");
  }

  async start(deviceId="") {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS or localhost in a supported browser.");
    this.stop();
    this.onStatus?.("Requesting camera permission…","loading");
    this.stream=await navigator.mediaDevices.getUserMedia({
      audio:false,video:{ deviceId:deviceId?{exact:deviceId}:undefined,width:{ideal:960},height:{ideal:540},frameRate:{ideal:30,max:30} }
    });
    this.video.srcObject=this.stream;
    await this.video.play();
    this.worker=new Worker(new URL("./spatial-hand-worker.mjs?v=2",import.meta.url),{type:"module"});
    this.worker.onmessage=event=>this.handleWorkerMessage(event.data);
    this.worker.onerror=event=>this.fail(event.message || "Hand-tracking worker failed.");
    this.worker.postMessage({
      type:"init",
      wasmRoot:new URL("/vendor/mediapipe/wasm",location.origin).href,
      modelUrl:new URL("./assets/models/hand_landmarker.task",location.href).href
    });
    this.running=true;
    this.onStatus?.("Loading the local hand model…","loading");
    requestAnimationFrame(timestamp=>this.capture(timestamp));
  }

  handleWorkerMessage(message) {
    if (message.type==="ready") {
      this.workerReady=true;
      this.onStatus?.("Camera ready · show one or two hands","ready");
      return;
    }
    if (message.type==="error") return this.fail(message.message);
    if (message.type!=="result") return;
    this.processing=false;
    const viewport={width:window.innerWidth,height:window.innerHeight};
    const frame=this.tracker.update(message.hands,viewport);
    this.draw(message.hands);
    this.onFrame?.(frame);
  }

  async capture(timestamp) {
    if (!this.running) return;
    requestAnimationFrame(next=>this.capture(next));
    if (!this.workerReady || this.processing || this.video.readyState<2 || timestamp-this.lastFrameAt<1000/this.frameRate) return;
    this.lastFrameAt=timestamp;
    this.processing=true;
    try {
      const bitmap=await createImageBitmap(this.video);
      this.worker.postMessage({type:"frame",bitmap,timestamp:performance.now()},[bitmap]);
    } catch (error) { this.processing=false; this.fail(error.message); }
  }

  draw(hands) {
    const width=this.video.videoWidth || 960; const height=this.video.videoHeight || 540;
    if (this.overlay.width!==width || this.overlay.height!==height) { this.overlay.width=width;this.overlay.height=height; }
    this.context.clearRect(0,0,width,height);
    if (!this.showSkeleton) return;
    this.context.lineWidth=Math.max(2,width/420); this.context.lineCap="round";
    hands.forEach((hand,index)=>{
      const landmarks=hand.landmarks || [];
      this.context.strokeStyle=index?"#f2c85f":"#5be0c1";
      this.context.fillStyle=this.context.strokeStyle;
      HAND_CONNECTIONS.forEach(([a,b])=>{
        if (!landmarks[a]||!landmarks[b]) return;
        this.context.beginPath();this.context.moveTo(landmarks[a].x*width,landmarks[a].y*height);
        this.context.lineTo(landmarks[b].x*width,landmarks[b].y*height);this.context.stroke();
      });
      landmarks.forEach((point,pointIndex)=>{
        this.context.beginPath();this.context.arc(point.x*width,point.y*height,pointIndex===8?6:3,0,Math.PI*2);this.context.fill();
      });
    });
  }

  fail(message) { this.onStatus?.(message || "Spatial controls stopped.","error"); this.stop(false); }

  stop(report=true) {
    this.running=false;this.workerReady=false;this.processing=false;this.tracker.reset();
    this.worker?.terminate();this.worker=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    if (this.video) this.video.srcObject=null;
    this.context?.clearRect(0,0,this.overlay.width,this.overlay.height);
    if (report) this.onStatus?.("Camera stopped · no frames retained","idle");
  }
}
