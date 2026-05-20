const RESERVED_IDS = new Set(["__proto__", "prototype", "constructor"]);

function asStringId(value, label) {
  if (value && typeof value === "object" && "id" in value) {
    return asStringId(value.id, label);
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new TypeError(`${label} must be a string, number, or object with an id`);
  }
  const id = String(value).trim();
  if (!id) throw new TypeError(`${label} must not be empty`);
  if (RESERVED_IDS.has(id)) throw new TypeError(`${label} uses a reserved id`);
  return id;
}

function normalizeLabel(value, fallback) {
  if (value == null) return fallback;
  return String(value);
}

function normalizeNumber(value, fallback) {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeNode(node, index) {
  if (!node || typeof node !== "object") {
    throw new TypeError(`nodes[${index}] must be an object`);
  }
  const id = asStringId(node.id, `nodes[${index}].id`);
  return {
    id,
    label: normalizeLabel(node.label, id),
    type: node.type == null ? "node" : String(node.type),
    subtype: node.subtype == null ? undefined : String(node.subtype),
    groupId: node.groupId == null ? undefined : String(node.groupId),
    parentId: node.parentId == null ? undefined : String(node.parentId),
    color: node.color == null ? undefined : String(node.color),
    geometry: node.geometry == null ? undefined : String(node.geometry),
    size: Math.max(0, normalizeNumber(node.size, 1)),
    x: normalizeNumber(node.x, undefined),
    y: normalizeNumber(node.y, undefined),
    z: normalizeNumber(node.z, undefined),
    hidden: Boolean(node.hidden),
    arrivalTime: normalizeNumber(node.arrivalTime, undefined),
    degree: normalizeNumber(node.degree, undefined),
    data: node.data,
  };
}

function normalizeEdge(edge, index) {
  if (!edge || typeof edge !== "object") {
    throw new TypeError(`edges[${index}] must be an object`);
  }
  const source = asStringId(edge.source, `edges[${index}].source`);
  const target = asStringId(edge.target, `edges[${index}].target`);
  return {
    source,
    target,
    kind: edge.kind == null ? "edge" : String(edge.kind),
    color: edge.color == null ? undefined : String(edge.color),
    opacity: normalizeNumber(edge.opacity, undefined),
    weight: Math.max(0, normalizeNumber(edge.weight, 1)),
    hidden: Boolean(edge.hidden),
    data: edge.data,
  };
}

export function validateGraphData(data, options = {}) {
  const errors = [];
  const warnings = [];
  const allowDanglingEdges = options.allowDanglingEdges === true;

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["graph data must be an object"], warnings };
  }
  if (!Array.isArray(data.nodes)) errors.push("graph data must include a nodes array");
  if (!Array.isArray(data.edges)) errors.push("graph data must include an edges array");
  if (errors.length) return { valid: false, errors, warnings };

  const ids = new Set();
  for (let i = 0; i < data.nodes.length; i++) {
    try {
      const id = asStringId(data.nodes[i]?.id, `nodes[${i}].id`);
      if (ids.has(id)) errors.push(`duplicate node id: ${id}`);
      ids.add(id);
    } catch (err) {
      errors.push(err.message);
    }
  }

  for (let i = 0; i < data.edges.length; i++) {
    try {
      const source = asStringId(data.edges[i]?.source, `edges[${i}].source`);
      const target = asStringId(data.edges[i]?.target, `edges[${i}].target`);
      if (!allowDanglingEdges && !ids.has(source)) errors.push(`edge ${i} references missing source: ${source}`);
      if (!allowDanglingEdges && !ids.has(target)) errors.push(`edge ${i} references missing target: ${target}`);
      if (source === target) warnings.push(`edge ${i} is a self-loop: ${source}`);
    } catch (err) {
      errors.push(err.message);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function normalizeGraphData(data, options = {}) {
  const validation = validateGraphData(data, options);
  if (!validation.valid && options.throwOnError !== false) {
    throw new Error(`invalid graph data: ${validation.errors.join("; ")}`);
  }

  const allowDanglingEdges = options.allowDanglingEdges === true;
  const nodes = [];
  const nodeById = new Map();
  for (let i = 0; i < (data?.nodes || []).length; i++) {
    const node = normalizeNode(data.nodes[i], i);
    if (nodeById.has(node.id)) continue;
    nodes.push(node);
    nodeById.set(node.id, node);
  }

  const edges = [];
  for (let i = 0; i < (data?.edges || []).length; i++) {
    const edge = normalizeEdge(data.edges[i], i);
    if (!allowDanglingEdges && (!nodeById.has(edge.source) || !nodeById.has(edge.target))) {
      continue;
    }
    edges.push(edge);
  }

  return {
    nodes,
    edges,
    nodeById,
    warnings: validation.warnings,
  };
}

export function createGraphModel(data, options = {}) {
  let normalized = normalizeGraphData(data, options);
  let neighborsById = buildNeighbors(normalized.nodes, normalized.edges);

  function refresh(nextData) {
    normalized = normalizeGraphData(nextData, options);
    neighborsById = buildNeighbors(normalized.nodes, normalized.edges);
    return api;
  }

  const api = {
    get nodes() {
      return normalized.nodes;
    },
    get edges() {
      return normalized.edges;
    },
    get warnings() {
      return normalized.warnings;
    },
    setData: refresh,
    getNode(id) {
      return normalized.nodeById.get(String(id));
    },
    degree(id) {
      return neighborsById.get(String(id))?.size || 0;
    },
    neighbors(id) {
      return [...(neighborsById.get(String(id)) || [])];
    },
    visibleNodes() {
      return normalized.nodes.filter((node) => !node.hidden);
    },
    visibleEdges() {
      return normalized.edges.filter((edge) =>
        !edge.hidden
        && !normalized.nodeById.get(edge.source)?.hidden
        && !normalized.nodeById.get(edge.target)?.hidden,
      );
    },
    toJSON() {
      return {
        nodes: normalized.nodes.map((node) => ({ ...node })),
        edges: normalized.edges.map((edge) => ({ ...edge })),
      };
    },
  };

  return api;
}

function buildNeighbors(nodes, edges) {
  const neighbors = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of edges) {
    if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) continue;
    neighbors.get(edge.source).add(edge.target);
    neighbors.get(edge.target).add(edge.source);
  }
  return neighbors;
}
