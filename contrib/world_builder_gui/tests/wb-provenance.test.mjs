import test from "node:test";
import assert from "node:assert/strict";
import { parseWorldBuilderText, serializeWorldBuilder, stripJsonComments } from "../wb-provenance.mjs";

test("commented World Builder files round-trip without damaging URLs", () => {
  const world = { version: "0.5", features: [{ name: "https://example.org/model" }] };
  const text = serializeWorldBuilder(world, {
    references: [{
      name: "Example", citation: "Example et al. (2026)",
      citationUrl: "https://doi.org/10.1000/example",
      sourceUrl: "https://example.org/data"
    }]
  });
  assert.match(text, /References and data provenance/);
  assert.deepEqual(parseWorldBuilderText(text), world);
  assert.equal(JSON.parse(stripJsonComments('{"url":"https://example.org/a//b"}')).url, "https://example.org/a//b");
});

test("plain strict JSON remains supported and comments can be disabled", () => {
  const world = { version: "0.5", features: [] };
  const text = serializeWorldBuilder(world, {}, { includeComments: false });
  assert.equal(text.startsWith("//"), false);
  assert.deepEqual(parseWorldBuilderText(text), world);
});
