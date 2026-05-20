import {
  create3dGraph,
  describeGraph,
  describeNode,
  traversalCandidates,
  validateGraphData,
} from "../../src/index.js";

const graphEl = document.getElementById("graph");
const summaryEl = document.getElementById("summary");
const titleEl = document.getElementById("panelTitle");
const metaEl = document.getElementById("panelMeta");
const neighborsEl = document.getElementById("neighbors");
const shootEl = document.getElementById("shoot");
const hubEl = document.getElementById("hub");
const focusEl = document.getElementById("focus");
const showAllEl = document.getElementById("showAll");

let graph;

function fail(message) {
  summaryEl.textContent = message;
  titleEl.textContent = "Graph unavailable";
  metaEl.textContent = "";
  neighborsEl.replaceChildren();
}

function renderPanel(node) {
  summaryEl.textContent = describeGraph(graph.model);
  neighborsEl.replaceChildren();

  if (!node) {
    titleEl.textContent = "No node selected";
    metaEl.textContent = "Shoot, click, or fly to a node.";
    return;
  }

  titleEl.textContent = node.label;
  metaEl.textContent = describeNode(node, graph.model, { maxNeighbors: 5 });

  for (const candidate of traversalCandidates(node.id, graph.model, { limit: 8 })) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = candidate.label;
    button.addEventListener("click", () => {
      graph.setFocus(candidate.id, { depth: 1, flyTo: true });
      renderPanel(candidate.node);
    });
    neighborsEl.append(button);
  }
}

function pickHub() {
  return graph.model
    .visibleNodes()
    .slice()
    .sort((a, b) => graph.model.degree(b.id) - graph.model.degree(a.id))[0];
}

function nodeColor(node) {
  if (node.type === "note") return "#ffbc70";
  if (node.type === "feature") return "#78e3c5";
  if (node.type === "scorecard") return "#f38ad5";
  if (node.type === "adapter") return "#8ab4ff";
  return "#d5dde8";
}

async function boot() {
  const response = await fetch("/graph.json");
  if (!response.ok) {
    fail(`Could not fetch graph.json: ${response.status}`);
    return;
  }

  const data = await response.json();
  const validation = validateGraphData(data);
  if (!validation.valid) {
    fail(validation.errors.join(" "));
    return;
  }

  graph = create3dGraph({
    container: graphEl,
    data,
    layout: "communities",
    flight: { speed: 1.15, pointerLock: true },
    style: {
      node(node, base) {
        return {
          ...base,
          color: node.color || nodeColor(node),
          geometry: node.geometry || (node.type === "scorecard" ? "octahedron" : base.geometry),
        };
      },
      edge(edge, base) {
        return {
          ...base,
          color: edge.color || base.color,
          opacity: edge.opacity ?? base.opacity,
        };
      },
    },
    onSelect: renderPanel,
    onProjectileHit(node) {
      renderPanel(node);
    },
    onProjectileMiss() {
      metaEl.textContent = "Shot missed the graph.";
    },
  });

  const hub = pickHub();
  if (hub) {
    graph.focusNode(hub.id, { radius: 650 });
    renderPanel(hub);
  } else {
    renderPanel(null);
  }
  globalThis.graph = graph;
}

shootEl.addEventListener("click", () => graph?.shoot({ select: true, flyTo: true }));
hubEl.addEventListener("click", () => {
  if (!graph) return;
  const hub = pickHub();
  if (hub) graph.flyToNode(hub.id, { durationMs: 750 });
});
focusEl.addEventListener("click", () => {
  const selected = graph?.getSelectedNode() || graph?.pickNodeAtCenter();
  if (selected) graph.setFocus(selected.id, { depth: 2, flyTo: true });
});
showAllEl.addEventListener("click", () => {
  graph?.clearFocus();
  renderPanel(graph?.getSelectedNode() || null);
});

boot().catch((error) => fail(error.message));
