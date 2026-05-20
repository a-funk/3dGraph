import test from "node:test";
import assert from "node:assert/strict";
import { GENERATION_PRESETS, generateGraphData } from "../src/index.js";

test("fixture generator exposes multiple configurable graph varieties", () => {
  assert.deepEqual(GENERATION_PRESETS, ["knowledge", "clusters", "constellation", "tree", "mesh"]);

  for (const preset of GENERATION_PRESETS) {
    const graph = generateGraphData({
      preset,
      nodeCount: 40,
      clusters: 5,
      edgeDensity: 0.05,
      seed: "stable",
    });

    assert.equal(graph.nodes.length, 40);
    assert.ok(graph.edges.length >= 35, `${preset} should generate a useful connected graph`);
    assert.ok(graph.nodes.every((node) => node.id && node.label && node.type));
  }
});

test("fixture generation is deterministic for the same seed", () => {
  const a = generateGraphData({ preset: "mesh", nodeCount: 24, seed: "same" });
  const b = generateGraphData({ preset: "mesh", nodeCount: 24, seed: "same" });

  assert.deepEqual(a, b);
});
