export function edgeEndpointId(value) {
  return value && typeof value === "object" ? value.id : value;
}

export function visibleEdges(edges) {
  return edges.filter((edge) => !edge.hidden);
}

export function createSeededRandom(seed = "3dgraph") {
  let h = 2166136261;
  const str = String(seed);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function random() {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashUnit(value) {
  let h = 5381;
  const str = String(value);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return ((h >>> 0) % 100000) / 100000;
}

export function fibonacciSphere(count, radius = 1) {
  const points = [];
  const total = Math.max(0, Math.floor(count));
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < total; i++) {
    const t = (i + 0.5) / total;
    const phi = Math.acos(1 - 2 * t);
    const theta = golden * i;
    points.push({
      x: radius * Math.sin(phi) * Math.cos(theta),
      y: radius * Math.sin(phi) * Math.sin(theta),
      z: radius * Math.cos(phi),
    });
  }
  return points;
}

export function degreeMap(nodes, edges) {
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of visibleEdges(edges)) {
    const source = edgeEndpointId(edge.source);
    const target = edgeEndpointId(edge.target);
    if (degree.has(source)) degree.set(source, degree.get(source) + 1);
    if (degree.has(target)) degree.set(target, degree.get(target) + 1);
  }
  return degree;
}

export function runLabelPropagation(nodes, edges, options = {}) {
  const maxIters = options.maxIters ?? 8;
  const random = options.random || createSeededRandom(options.seed || "communities");
  const adj = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of visibleEdges(edges)) {
    const source = edgeEndpointId(edge.source);
    const target = edgeEndpointId(edge.target);
    if (adj.has(source)) adj.get(source).push(target);
    if (adj.has(target)) adj.get(target).push(source);
  }

  const labels = new Map(nodes.map((node) => [node.id, node.id]));
  const ids = nodes.map((node) => node.id);
  for (let iter = 0; iter < maxIters; iter++) {
    shuffle(ids, random);
    let changed = 0;
    for (const id of ids) {
      const neighbors = adj.get(id);
      if (!neighbors || neighbors.length === 0) continue;
      const counts = new Map();
      for (const neighbor of neighbors) {
        const label = labels.get(neighbor);
        counts.set(label, (counts.get(label) || 0) + 1);
      }
      let best = labels.get(id);
      let bestCount = -1;
      for (const [label, count] of counts) {
        if (count > bestCount || (count === bestCount && String(label) < String(best))) {
          best = label;
          bestCount = count;
        }
      }
      if (labels.get(id) !== best) {
        labels.set(id, best);
        changed++;
      }
    }
    if (changed === 0) break;
  }
  return labels;
}

export function computeKCore(nodes, edges) {
  const adj = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const edge of visibleEdges(edges)) {
    const source = edgeEndpointId(edge.source);
    const target = edgeEndpointId(edge.target);
    if (adj.has(source) && adj.has(target)) {
      adj.get(source).add(target);
      adj.get(target).add(source);
    }
  }

  const degree = new Map();
  for (const [id, neighbors] of adj) degree.set(id, neighbors.size);
  const coreness = new Map();
  const remaining = new Set(degree.keys());

  while (remaining.size > 0) {
    let minDegree = Infinity;
    for (const id of remaining) {
      const d = degree.get(id);
      if (d < minDegree) {
        minDegree = d;
        if (d === 0) break;
      }
    }

    let frontier = [...remaining].filter((id) => degree.get(id) <= minDegree);
    while (frontier.length > 0) {
      const next = [];
      for (const id of frontier) {
        if (!remaining.has(id)) continue;
        coreness.set(id, minDegree);
        remaining.delete(id);
        for (const neighbor of adj.get(id)) {
          if (!remaining.has(neighbor)) continue;
          degree.set(neighbor, degree.get(neighbor) - 1);
          if (degree.get(neighbor) <= minDegree) next.push(neighbor);
        }
      }
      frontier = next;
    }
  }

  return coreness;
}

function shuffle(values, random) {
  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}
