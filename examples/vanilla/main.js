import { create3dGraph, generateGraphData } from "../../src/index.js";

const graphEl = document.getElementById("graph");
const presetEl = document.getElementById("preset");
const layoutEl = document.getElementById("layout");
const nodesEl = document.getElementById("nodes");
const regenerateEl = document.getElementById("regenerate");
const flightEl = document.getElementById("flight");
const detailEl = document.getElementById("detail");

function buildData() {
  return generateGraphData({
    preset: presetEl.value,
    nodeCount: Number(nodesEl.value),
    clusters: Math.max(3, Math.round(Number(nodesEl.value) / 42)),
    edgeDensity: presetEl.value === "mesh" ? 0.14 : 0.07,
    seed: `${presetEl.value}:${nodesEl.value}`,
  });
}

const graph = create3dGraph({
  container: graphEl,
  data: buildData(),
  layout: layoutEl.value,
  flight: { speed: 1.2, pointerLock: true },
  style: {
    node(node, base) {
      if (node.type === "document") return { ...base, geometry: "cube" };
      if (node.type === "concept") return { ...base, geometry: "octahedron" };
      return base;
    },
  },
  onSelect(node) {
    detailEl.textContent = `${node.label} · ${node.type} · degree ${graph.model.degree(node.id)}`;
  },
  onModeChange(mode) {
    flightEl.textContent = mode === "flight" ? "Orbit" : "Flight";
  },
});

function regenerate() {
  graph.setData(buildData(), { layout: layoutEl.value });
  detailEl.textContent = "Select a node";
}

regenerateEl.addEventListener("click", regenerate);
presetEl.addEventListener("change", regenerate);
nodesEl.addEventListener("input", regenerate);
layoutEl.addEventListener("change", () => graph.setLayout(layoutEl.value));
flightEl.addEventListener("click", () => {
  if (graph.cameraMode === "flight") graph.flight.exit();
  else graph.flight.enter();
});

globalThis.graph = graph;
