import { createSeededRandom } from "../layouts/index.js";

export const GENERATION_PRESETS = [
  "knowledge",
  "clusters",
  "constellation",
  "tree",
  "mesh",
];

const TYPE_SETS = {
  knowledge: ["concept", "document", "tag", "cluster", "node"],
  clusters: ["cluster", "node", "tag"],
  constellation: ["concept", "node", "tag"],
  tree: ["cluster", "document", "node"],
  mesh: ["node", "concept", "document"],
};

function choice(values, random) {
  return values[Math.floor(random() * values.length)];
}

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function addEdge(edges, seen, source, target, kind = "related", weight = 1) {
  if (source === target) return;
  const a = String(source);
  const b = String(target);
  const key = a < b ? `${a}:${b}` : `${b}:${a}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ source: a, target: b, kind, weight });
}

export function generateGraphData(options = {}) {
  const preset = GENERATION_PRESETS.includes(options.preset) ? options.preset : "knowledge";
  const nodeCount = clampInt(options.nodeCount ?? options.nodes ?? 180, 2, 50000);
  const clusterCount = clampInt(options.clusters ?? Math.sqrt(nodeCount) / 2, 1, Math.min(80, nodeCount));
  const edgeDensity = Math.max(0, Math.min(1, Number(options.edgeDensity ?? 0.08)));
  const random = options.random || createSeededRandom(options.seed || `${preset}:${nodeCount}:${clusterCount}`);
  const typeSet = TYPE_SETS[preset] || TYPE_SETS.knowledge;
  const nodes = [];
  const edges = [];
  const seen = new Set();

  for (let i = 0; i < clusterCount; i++) {
    nodes.push({
      id: `cluster-${i}`,
      label: `${labelForPreset(preset)} ${i + 1}`,
      type: preset === "tree" ? "cluster" : choice(["cluster", "concept"], random),
      groupId: `cluster-${i}`,
      size: 10 + random() * 8,
    });
  }

  for (let i = clusterCount; i < nodeCount; i++) {
    const group = Math.floor(random() * clusterCount);
    nodes.push({
      id: `node-${i}`,
      label: `${choice(["Signal", "Note", "Paper", "Idea", "Artifact"], random)} ${i}`,
      type: choice(typeSet, random),
      groupId: `cluster-${group}`,
      size: 3 + random() * 5,
      data: { score: Number(random().toFixed(3)) },
    });
  }

  if (preset === "tree") {
    for (let i = 1; i < nodes.length; i++) {
      const parent = nodes[Math.floor((i - 1) * random())];
      addEdge(edges, seen, parent.id, nodes[i].id, "parent", 1.4);
    }
  } else {
    for (const node of nodes.slice(clusterCount)) {
      addEdge(edges, seen, node.groupId, node.id, "member", 1.2);
      if (preset === "mesh" || random() < 0.45) {
        const peer = nodes[clusterCount + Math.floor(random() * Math.max(1, nodeCount - clusterCount))];
        if (peer) addEdge(edges, seen, node.id, peer.id, "related", 0.7 + random());
      }
    }
  }

  if (preset === "constellation" || preset === "knowledge") {
    for (let i = 0; i < clusterCount; i++) {
      const next = (i + 1) % clusterCount;
      addEdge(edges, seen, `cluster-${i}`, `cluster-${next}`, "bridge", 0.55);
    }
  }

  const targetExtras = Math.floor(nodeCount * edgeDensity * (preset === "mesh" ? 6 : 2));
  for (let i = 0; i < targetExtras; i++) {
    const source = nodes[Math.floor(random() * nodes.length)];
    const target = nodes[Math.floor(random() * nodes.length)];
    addEdge(edges, seen, source.id, target.id, choice(["related", "cites", "supports", "contrasts"], random), 0.4 + random() * 1.6);
  }

  return { nodes, edges };
}

function labelForPreset(preset) {
  switch (preset) {
    case "clusters": return "Cluster";
    case "constellation": return "Constellation";
    case "tree": return "Branch";
    case "mesh": return "Mesh Hub";
    case "knowledge":
    default: return "Concept";
  }
}
