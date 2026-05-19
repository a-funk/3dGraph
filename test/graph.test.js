import test from "node:test";
import assert from "node:assert/strict";
import { createGraphModel, normalizeGraphData, validateGraphData } from "../src/index.js";

test("normalizes graph data into documented fields", () => {
  const graph = normalizeGraphData({
    nodes: [
      { id: "a", label: "Alpha", type: "concept", size: 3, raw: { ignored: true } },
      { id: 2 },
    ],
    edges: [
      { source: "a", target: 2, weight: 2 },
    ],
  });

  assert.equal(graph.nodes[0].id, "a");
  assert.equal(graph.nodes[0].label, "Alpha");
  assert.equal(graph.nodes[1].id, "2");
  assert.equal(graph.edges[0].source, "a");
  assert.equal(graph.edges[0].target, "2");
  assert.equal(graph.nodes[0].data, undefined);
});

test("rejects duplicate nodes and dangling edges by default", () => {
  const result = validateGraphData({
    nodes: [{ id: "a" }, { id: "a" }],
    edges: [{ source: "a", target: "missing" }],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /duplicate node id: a/);
  assert.match(result.errors.join("\n"), /missing target: missing/);
});

test("graph model exposes degree, neighbors, and visible subsets", () => {
  const model = createGraphModel({
    nodes: [{ id: "a" }, { id: "b" }, { id: "c", hidden: true }],
    edges: [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ],
  });

  assert.equal(model.degree("a"), 2);
  assert.deepEqual(model.neighbors("a").sort(), ["b", "c"]);
  assert.deepEqual(model.visibleNodes().map((node) => node.id), ["a", "b"]);
  assert.deepEqual(model.visibleEdges().map((edge) => `${edge.source}:${edge.target}`), ["a:b"]);
});
