import test from "node:test";
import assert from "node:assert/strict";
import {
  LAYOUT_VARIANTS,
  computeKCore,
  createForceLayout3D,
  createSeededRandom,
  degreeMap,
  fibonacciSphere,
  runLabelPropagation,
} from "../src/index.js";

test("seeded random is deterministic", () => {
  const a = createSeededRandom("same");
  const b = createSeededRandom("same");
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test("fibonacci sphere returns points at the requested radius", () => {
  const points = fibonacciSphere(5, 10);
  assert.equal(points.length, 5);
  for (const point of points) {
    const radius = Math.hypot(point.x, point.y, point.z);
    assert.ok(Math.abs(radius - 10) < 1e-9);
  }
});

test("graph analysis helpers compute degree and k-core", () => {
  const nodes = ["a", "b", "c", "d"].map((id) => ({ id }));
  const edges = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "a" },
    { source: "c", target: "d" },
  ];

  assert.equal(degreeMap(nodes, edges).get("c"), 3);
  const core = computeKCore(nodes, edges);
  assert.equal(core.get("a"), 2);
  assert.equal(core.get("d"), 1);
});

test("label propagation groups a simple connected component", () => {
  const nodes = ["a", "b", "c"].map((id) => ({ id }));
  const edges = [{ source: "a", target: "b" }, { source: "b", target: "c" }];
  const labels = runLabelPropagation(nodes, edges, { seed: "labels" });
  assert.equal(new Set(labels.values()).size, 1);
});

test("force layout builder fails clearly without d3-force-3d", () => {
  assert.deepEqual([...LAYOUT_VARIANTS], ["default", "galaxies", "communities", "core"]);
  assert.throws(
    () => createForceLayout3D({ d3: {}, nodes: [], edges: [] }),
    /d3-force-3d compatible object/,
  );
});
