import test from "node:test";
import assert from "node:assert/strict";
import { ThreeGraph, create3dGraph } from "../src/index.js";

test("renderer API is exported and fails clearly without a container", () => {
  assert.equal(typeof create3dGraph, "function");
  assert.equal(typeof ThreeGraph, "function");
  assert.throws(() => create3dGraph(), /requires a container element/);
});

test("renderer prototype exposes production-grade interaction APIs", () => {
  const proto = ThreeGraph.prototype;
  assert.equal(typeof proto.pickNode, "function");
  assert.equal(typeof proto.pickNodeAtCenter, "function");
  assert.equal(typeof proto.shoot, "function");
  assert.equal(typeof proto.flyToNode, "function");
  assert.equal(typeof proto.setFocus, "function");
  assert.equal(typeof proto.clearFocus, "function");
  assert.equal(typeof proto.getState, "function");
  assert.equal(typeof proto.getSelectedNode, "function");
});
