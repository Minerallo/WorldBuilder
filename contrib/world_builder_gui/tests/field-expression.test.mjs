import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFieldExpression, parseFieldExpression } from "../field-expression.mjs";

const grid={nx:3,ny:2,dx:1,dy:1};

test("field expressions respect precedence and scalar broadcasting",()=>{
  const result=evaluateFieldExpression("a + b * 2",{a:[1,2,3,4,5,6],b:[10,20,30,40,50,60]},grid);
  assert.deepEqual(result.values,[21,42,63,84,105,126]);
  assert.deepEqual(result.identifiers.sort(),["a","b"]);
});

test("field expressions provide conditionals and scientific functions",()=>{
  const result=evaluateFieldExpression("where(a > 2, clamp(a, 0, 4), 0)",{a:[-1,1,3,5,2,4]},grid);
  assert.deepEqual(result.values,[0,0,3,4,0,4]);
  const normalized=evaluateFieldExpression("normalize(a)",{a:[0,2,4,6,8,10]},grid);
  assert.deepEqual(normalized.values,[0,.2,.4,.6,.8,1]);
});

test("field expressions compute grid derivatives",()=>{
  const result=evaluateFieldExpression("gradx(a)",{a:[0,2,4,0,2,4]},grid);
  assert.deepEqual(result.values,[2,2,2,2,2,2]);
});

test("field expression parser rejects unknown syntax and functions",()=>{
  assert.throws(()=>parseFieldExpression("a + @"),/Unexpected character/);
  assert.throws(()=>parseFieldExpression("mystery(a)"),/Unknown function/);
  assert.throws(()=>evaluateFieldExpression("missing + 1",{},grid),/Unknown field/);
});
