import test from "node:test";
import assert from "node:assert/strict";
import {
  createGraphModel,
  describeGraph,
  describeNode,
  graphStats,
  traversalCandidates,
} from "../src/index.js";

const data = {
  nodes: [
    { id: "hub", label: "Knowledge Hub", type: "note" },
    { id: "flight", label: "Flight Controls", type: "feature" },
    { id: "shoot", label: "Shoot to Select", type: "feature" },
    { id: "hidden", label: "Hidden Draft", type: "note", hidden: true },
  ],
  edges: [
    { source: "hub", target: "flight", kind: "links" },
    { source: "hub", target: "shoot", kind: "links" },
    { source: "hub", target: "hidden", kind: "draft" },
  ],
};

test("graphStats summarizes raw graph data for accessible overviews", () => {
  const stats = graphStats(data);

  assert.equal(stats.nodeCount, 4);
  assert.equal(stats.visibleNodeCount, 3);
  assert.equal(stats.visibleEdgeCount, 2);
  assert.deepEqual(stats.types, { note: 1, feature: 2 });
  assert.deepEqual(stats.edgeKinds, { links: 2 });
});

test("describeGraph and describeNode work with graph models", () => {
  const model = createGraphModel(data);

  assert.match(describeGraph(model), /3 visible nodes and 2 visible edges/);
  assert.match(describeGraph(model), /feature \(2\)/);
  assert.equal(
    describeNode("hub", model, { maxNeighbors: 2 }),
    "Knowledge Hub, note, degree 3. Connected to Flight Controls, Shoot to Select, and 1 more.",
  );
});

test("traversalCandidates returns ranked neighbor targets", () => {
  const model = createGraphModel(data);
  const candidates = traversalCandidates("hub", model, { limit: 2 });

  assert.deepEqual(candidates.map((candidate) => candidate.id), ["flight", "shoot"]);
  assert.deepEqual(candidates.map((candidate) => candidate.label), ["Flight Controls", "Shoot to Select"]);
});
