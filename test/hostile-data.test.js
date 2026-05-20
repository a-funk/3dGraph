import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createGraphModel,
  normalizeGraphData,
  validateGraphData,
} from "../src/index.js";
import { resolveThreeColor } from "../src/renderers/three-graph.js";

function sourceFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...sourceFiles(path));
    else if (path.endsWith(".js")) files.push(path);
  }
  return files;
}

test("hostile identifiers fail before prototype-shaped ids enter the model", () => {
  const result = validateGraphData({
    nodes: [
      { id: "safe" },
      { id: "__proto__" },
      { id: "constructor" },
    ],
    edges: [{ source: "safe", target: "missing" }],
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /nodes\[1\]\.id uses a reserved id/);
  assert.match(result.errors.join("\n"), /nodes\[2\]\.id uses a reserved id/);
  assert.match(result.errors.join("\n"), /missing target: missing/);
});

test("unsafe labels stay plain data and source never writes them as HTML", () => {
  const label = "<img src=x onerror=alert(1)><script>alert(2)</script>";
  const graph = normalizeGraphData({
    nodes: [{ id: "xss", label }],
    edges: [],
  });

  assert.equal(graph.nodes[0].label, label);
  for (const file of sourceFiles(fileURLToPath(new URL("../src", import.meta.url)))) {
    const text = readFileSync(file, "utf8");
    assert.equal(text.includes(".innerHTML"), false, `${file} writes innerHTML`);
  }
});

test("cyclic metadata and huge payloads are preserved without JSON cloning", () => {
  const cyclic = { title: "cycle" };
  cyclic.self = cyclic;
  const huge = "x".repeat(128_000);
  const model = createGraphModel({
    nodes: [
      { id: "cycle", data: cyclic },
      { id: "huge", data: { huge } },
    ],
    edges: [{ source: "cycle", target: "huge", data: cyclic }],
  });

  assert.equal(model.getNode("cycle").data.self, cyclic);
  assert.equal(model.getNode("huge").data.huge.length, 128_000);
  assert.equal(model.edges[0].data.self, cyclic);
});

test("large sparse graphs normalize without hidden product limits", () => {
  const nodes = Array.from({ length: 50_000 }, (_, i) => ({ id: `n-${i}` }));
  const edges = Array.from({ length: 2_000 }, (_, i) => ({
    source: `n-${i}`,
    target: `n-${(i * 37 + 11) % nodes.length}`,
  }));

  const graph = normalizeGraphData({ nodes, edges });

  assert.equal(graph.nodes.length, 50_000);
  assert.equal(graph.edges.length, 2_000);
  assert.equal(graph.nodeById.get("n-49999").label, "n-49999");
});

test("dangling edges can be inspected or dropped by policy", () => {
  const data = {
    nodes: [{ id: "known" }],
    edges: [{ source: "known", target: "missing" }],
  };

  const strict = validateGraphData(data);
  assert.equal(strict.valid, false);

  const inspected = normalizeGraphData(data, { allowDanglingEdges: true });
  assert.equal(inspected.edges.length, 1);

  const lossy = normalizeGraphData(data, { throwOnError: false });
  assert.equal(lossy.edges.length, 0);
});

test("malformed colors fall back without noisy Three.js warnings", () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    assert.equal(resolveThreeColor("<script>", "#123456").getHexString(), "123456");
    assert.equal(resolveThreeColor("not-a-color", "#654321").getHexString(), "654321");
    assert.equal(resolveThreeColor("#ff00aa", "#654321").getHexString(), "ff00aa");
    assert.equal(resolveThreeColor("red", "#654321").getHexString(), "ff0000");
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, []);
});
