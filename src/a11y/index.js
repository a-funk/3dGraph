function endpointId(value) {
  if (value && typeof value === "object" && "id" in value) return String(value.id);
  return String(value);
}

function nodesFor(graph) {
  return Array.isArray(graph?.nodes) ? graph.nodes : [];
}

function edgesFor(graph) {
  return Array.isArray(graph?.edges) ? graph.edges : [];
}

function visibleNodesFor(graph) {
  if (typeof graph?.visibleNodes === "function") return graph.visibleNodes();
  return nodesFor(graph).filter((node) => !node.hidden);
}

function visibleEdgesFor(graph) {
  if (typeof graph?.visibleEdges === "function") return graph.visibleEdges();
  const nodeById = new Map(nodesFor(graph).map((node) => [endpointId(node.id), node]));
  return edgesFor(graph).filter((edge) => {
    if (edge.hidden) return false;
    const source = nodeById.get(endpointId(edge.source));
    const target = nodeById.get(endpointId(edge.target));
    return Boolean(source && target && !source.hidden && !target.hidden);
  });
}

function getNode(graph, idOrNode) {
  if (idOrNode && typeof idOrNode === "object" && "id" in idOrNode) return idOrNode;
  if (typeof graph?.getNode === "function") return graph.getNode(idOrNode);
  const id = endpointId(idOrNode);
  return nodesFor(graph).find((node) => endpointId(node.id) === id) || null;
}

function nodeLabel(node) {
  return node?.label || endpointId(node?.id ?? "unknown");
}

function neighborIdsFor(graph, id) {
  if (typeof graph?.neighbors === "function") return graph.neighbors(id).map(String);
  const targetId = endpointId(id);
  const neighbors = new Set();
  for (const edge of visibleEdgesFor(graph)) {
    const source = endpointId(edge.source);
    const target = endpointId(edge.target);
    if (source === targetId) neighbors.add(target);
    if (target === targetId) neighbors.add(source);
  }
  return [...neighbors];
}

function degreeFor(graph, id) {
  if (typeof graph?.degree === "function") return graph.degree(id);
  return neighborIdsFor(graph, id).length;
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts, max = 4) {
  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max);
  return entries.map(([key, count]) => `${key} (${count})`).join(", ");
}

export function graphStats(graph) {
  const nodes = nodesFor(graph);
  const edges = edgesFor(graph);
  const visibleNodes = visibleNodesFor(graph);
  const visibleEdges = visibleEdgesFor(graph);
  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    visibleNodeCount: visibleNodes.length,
    visibleEdgeCount: visibleEdges.length,
    hiddenNodeCount: Math.max(0, nodes.length - visibleNodes.length),
    hiddenEdgeCount: Math.max(0, edges.length - visibleEdges.length),
    types: countBy(visibleNodes, (node) => node.type || "node"),
    edgeKinds: countBy(visibleEdges, (edge) => edge.kind || "edge"),
  };
}

export function describeGraph(graph, options = {}) {
  const stats = graphStats(graph);
  const maxTypes = options.maxTypes ?? 4;
  const typeText = formatCounts(stats.types, maxTypes);
  const edgeText = formatCounts(stats.edgeKinds, maxTypes);
  const parts = [
    `Graph with ${stats.visibleNodeCount} visible nodes and ${stats.visibleEdgeCount} visible edges.`,
  ];
  if (stats.hiddenNodeCount || stats.hiddenEdgeCount) {
    parts.push(`${stats.hiddenNodeCount} hidden nodes and ${stats.hiddenEdgeCount} hidden edges are excluded.`);
  }
  if (typeText) parts.push(`Node types: ${typeText}.`);
  if (edgeText) parts.push(`Edge types: ${edgeText}.`);
  return parts.join(" ");
}

export function describeNode(nodeOrId, graph, options = {}) {
  const node = getNode(graph, nodeOrId);
  if (!node) return `Node ${endpointId(nodeOrId)} is not in the graph.`;

  const maxNeighbors = options.maxNeighbors ?? 5;
  const degree = degreeFor(graph, node.id);
  const type = node.type || "node";
  const candidates = traversalCandidates(node.id, graph, { limit: maxNeighbors });
  const names = candidates.map((candidate) => candidate.label);
  const more = Math.max(0, degree - names.length);
  const neighborText = names.length
    ? ` Connected to ${names.join(", ")}${more ? `, and ${more} more` : ""}.`
    : "";
  return `${nodeLabel(node)}, ${type}, degree ${degree}.${neighborText}`;
}

export function traversalCandidates(nodeOrId, graph, options = {}) {
  const node = getNode(graph, nodeOrId);
  if (!node) return [];

  const limit = Math.max(0, options.limit ?? 8);
  const candidates = neighborIdsFor(graph, node.id)
    .map((id) => getNode(graph, id))
    .filter(Boolean)
    .filter((candidate) => options.includeHidden || !candidate.hidden)
    .map((candidate) => ({
      id: endpointId(candidate.id),
      label: nodeLabel(candidate),
      type: candidate.type || "node",
      degree: degreeFor(graph, candidate.id),
      node: candidate,
    }))
    .sort((a, b) => b.degree - a.degree || a.label.localeCompare(b.label));

  return limit ? candidates.slice(0, limit) : candidates;
}
