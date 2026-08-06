import test from "node:test";
import assert from "node:assert/strict";
import { advanceTutorialAction, shouldBlockTutorialInteraction } from "../tutorial-engine.mjs";

test("tutorial steps ignore unrelated events and targets", () => {
  assert.deepEqual(advanceTutorialAction({ event:"click",count:1 },"change",true,0),{ matched:false,count:0,complete:false });
  assert.deepEqual(advanceTutorialAction({ event:"click",count:1 },"click",false,0),{ matched:false,count:0,complete:false });
});

test("multi-action tutorial steps unlock only at the required count", () => {
  const first = advanceTutorialAction({ event:"pointerup",count:2 },"pointerup",true,0);
  const second = advanceTutorialAction({ event:"pointerup",count:2 },"pointerup",true,first.count);
  assert.equal(first.complete,false);
  assert.equal(second.complete,true);
  assert.equal(second.count,2);
});

test("change checkpoints accept live input and committed change events", () => {
  assert.equal(advanceTutorialAction({ event:"change" },"input",true,0).complete,true);
  assert.equal(advanceTutorialAction({ event:"change" },"change",true,0).complete,true);
});

test("guided mode blocks trusted interactions outside the current target", () => {
  assert.equal(shouldBlockTutorialInteraction({
    active:true,trusted:true,withinControls:false,targetMatches:false
  }),true);
  assert.equal(shouldBlockTutorialInteraction({
    active:true,trusted:true,withinControls:false,targetMatches:true
  }),false);
});

test("guided controls and programmatic preparation remain available", () => {
  assert.equal(shouldBlockTutorialInteraction({
    active:true,trusted:true,withinControls:true,targetMatches:false
  }),false);
  assert.equal(shouldBlockTutorialInteraction({
    active:true,trusted:false,withinControls:false,targetMatches:false
  }),false);
});
