import test from "node:test";
import assert from "node:assert/strict";
import { ThreeGraph, create3dGraph } from "../src/index.js";

test("renderer API is exported and fails clearly without a container", () => {
  assert.equal(typeof create3dGraph, "function");
  assert.equal(typeof ThreeGraph, "function");
  assert.throws(() => create3dGraph(), /requires a container element/);
});
