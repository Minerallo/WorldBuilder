import test from "node:test";
import assert from "node:assert/strict";
import { handPinchRatio, mapLandmarkToViewport, smoothPoint, twoHandTransform, SpatialGestureTracker } from "../spatial-engine.mjs";

function hand(tipDistance=.1,handedness="Right") {
  const landmarks=Array.from({length:21},()=>({x:.5,y:.5,z:0}));
  landmarks[5]={x:.3,y:.5,z:0};landmarks[17]={x:.7,y:.5,z:0};
  landmarks[4]={x:.5,y:.5,z:0};landmarks[8]={x:.5+tipDistance,y:.5,z:0};
  return {landmarks,handedness};
}

test("pinch ratio is normalized by palm size",()=>{
  assert.ok(handPinchRatio(hand(.04).landmarks)<handPinchRatio(hand(.2).landmarks));
});

test("viewport mapping mirrors the camera and clamps margins",()=>{
  assert.deepEqual(mapLandmarkToViewport({x:.2,y:.5,z:0},{width:1000,height:500},{mirror:true,margin:0}),{x:800,y:250,z:0});
});

test("point smoothing retains stable motion",()=>{
  assert.deepEqual(smoothPoint({x:0,y:0,z:0},{x:10,y:20,z:2},.5),{x:5,y:10,z:1});
});

test("two-hand transforms report zoom rotation and pan",()=>{
  const transform=twoHandTransform({left:{x:0,y:0},right:{x:10,y:0}},{left:{x:2,y:1},right:{x:2,y:21}});
  assert.equal(transform.scale,2);assert.equal(Math.round(transform.rotation),90);assert.equal(transform.panX,-3);assert.equal(transform.panY,11);
});

test("gesture tracker adds pinch hysteresis",()=>{
  const tracker=new SpatialGestureTracker({pinchThreshold:.3,releaseThreshold:.5,mirror:false,smoothing:0});
  const first=tracker.update([hand(.08)],{width:100,height:100}).primary;
  const second=tracker.update([hand(.16)],{width:100,height:100}).primary;
  const third=tracker.update([hand(.24)],{width:100,height:100}).primary;
  assert.equal(first.pinchStart,true);assert.equal(second.pinching,true);assert.equal(third.pinchEnd,true);
});

test("two-hand tracking keeps left and right stable when detector order changes",()=>{
  const tracker=new SpatialGestureTracker({pinchThreshold:.3,releaseThreshold:.5,mirror:false,smoothing:0});
  const left=hand(.04,"Left"),right=hand(.04,"Right");
  left.landmarks[4].x=.23;left.landmarks[8].x=.25;
  right.landmarks[4].x=.73;right.landmarks[8].x=.75;
  tracker.update([right,left],{width:100,height:100});
  left.landmarks[4].x=.18;left.landmarks[8].x=.2;
  right.landmarks[4].x=.78;right.landmarks[8].x=.8;
  const frame=tracker.update([left,right],{width:100,height:100});
  assert.equal(frame.twoHand,true);
  assert.ok(frame.transform.scale>1);
});
