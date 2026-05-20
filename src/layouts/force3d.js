import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from "d3-force-3d";

import {
  computeKCore,
  createSeededRandom,
  degreeMap,
  edgeEndpointId,
  fibonacciSphere,
  hashUnit,
  runLabelPropagation,
} from "./analysis.js";

export const LAYOUT_VARIANTS = [
  "default",
  "galaxies",
  "communities",
  "core",
];

const defaultD3 = {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceRadial,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
};

function requireD3(d3) {
  const required = ["forceSimulation", "forceLink", "forceManyBody", "forceCenter", "forceCollide"];
  for (const name of required) {
    if (!d3 || typeof d3[name] !== "function") {
      throw new TypeError(`createForceLayout3D requires a d3-force-3d compatible object with ${name}()`);
    }
  }
}

function defaultChargeStrength(node) {
  if (node.type === "idea" || node.type === "concept" || node.type === "cluster") return -340;
  if (node.type === "list" || node.type === "collection") return -290;
  if (node.type === "meta" || node.type === "tag") return -110;
  return -60;
}

function endpointNodeId(edge, side) {
  return edgeEndpointId(edge[side]);
}

function resetVelocity(node) {
  node.vx = 0;
  node.vy = 0;
  node.vz = 0;
}

function scatterOnSphere(nodes, radius, random) {
  const total = nodes.length || 1;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nodes.length; i++) {
    const t = (i + 0.5) / total;
    const phi = Math.acos(1 - 2 * t);
    const theta = golden * i;
    const r = radius * (0.85 + random() * 0.3);
    nodes[i].x = r * Math.sin(phi) * Math.cos(theta);
    nodes[i].y = r * Math.sin(phi) * Math.sin(theta);
    nodes[i].z = r * Math.cos(phi);
    resetVelocity(nodes[i]);
  }
}

function attachRandomSource(sim, random) {
  if (typeof sim.randomSource === "function") sim.randomSource(random);
  return sim;
}

function buildDefault(d3, nodes, edges, options) {
  const random = options.random;
  const chargeStrength = options.chargeStrength || defaultChargeStrength;
  const total = nodes.length || 1;
  const targetRadius = options.radius ?? Math.max(2200, Math.sqrt(total) * 70);
  scatterOnSphere(nodes, targetRadius, random);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const degrees = degreeMap(nodes, edges);
  function hubSpacingMultiplier(edge) {
    let multiplier = 1;
    for (const id of [endpointNodeId(edge, "source"), endpointNodeId(edge, "target")]) {
      const node = byId.get(id);
      if (!node || (node.type !== "meta" && node.type !== "tag")) continue;
      const degree = degrees.get(id) || 0;
      if (degree >= 250) multiplier = Math.max(multiplier, 5.5);
      else if (degree >= 80) multiplier = Math.max(multiplier, 3.1);
      else if (degree >= 45) multiplier = Math.max(multiplier, 2.1);
    }
    return multiplier;
  }

  const link = d3.forceLink(edges).id((node) => node.id)
    .strength((edge) => (0.026 * (edge.weight || 1)) / Math.pow(hubSpacingMultiplier(edge), 1.45))
    .distance((edge) => (255 * hubSpacingMultiplier(edge)) / Math.max(0.3, edge.weight || 1));
  const sim = d3.forceSimulation(nodes, 3)
    .force("link", link)
    .force("charge", d3.forceManyBody().strength((node) => chargeStrength(node) * 3.4))
    .force("center", d3.forceCenter(0, 0, 0).strength(0.008))
    .force("radial", d3.forceRadial(targetRadius, 0, 0, 0).strength(0.018))
    .force("collide", d3.forceCollide().radius((node) => (node.size || 6) + 18).strength(0.82))
    .alphaDecay(0.025)
    .alphaMin(0.012)
    .velocityDecay(0.43);
  return attachRandomSource(sim, random);
}

function clusterForNode(node, byId) {
  if (node.groupId) return node.groupId;
  if (node.type === "idea" || node.type === "concept" || node.type === "cluster") return node.id;
  if (node.type === "meta" || node.type === "tag") return node.id;
  return byId.has(node.parentId) ? node.parentId : node.id;
}

function buildGalaxies(d3, nodes, edges, options) {
  const random = options.random;
  const chargeStrength = options.chargeStrength || defaultChargeStrength;
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const clusters = new Map();
  const clusterIds = [];
  for (const node of nodes) {
    const clusterId = clusterForNode(node, byId);
    clusters.set(node.id, clusterId);
    if (!clusterIds.includes(clusterId)) clusterIds.push(clusterId);
  }

  const radius = options.radius ?? Math.max(2000, Math.sqrt(nodes.length || 1) * 60);
  const anchors = fibonacciSphere(clusterIds.length, radius);
  const anchorByCluster = new Map(clusterIds.map((id, index) => [id, anchors[index]]));
  const anchorForNode = (node) => anchorByCluster.get(clusters.get(node.id)) || { x: 0, y: 0, z: 0 };
  for (const node of nodes) {
    const anchor = anchorForNode(node);
    node.x = anchor.x + (random() - 0.5) * 200;
    node.y = anchor.y + (random() - 0.5) * 200;
    node.z = anchor.z + (random() - 0.5) * 200;
    resetVelocity(node);
  }

  const link = d3.forceLink(edges).id((node) => node.id)
    .strength((edge) => {
      const same = clusters.get(endpointNodeId(edge, "source")) === clusters.get(endpointNodeId(edge, "target"));
      return (same ? 0.08 : 0.005) * (edge.weight || 1);
    })
    .distance((edge) => 60 / Math.max(0.3, edge.weight || 1));

  const sim = d3.forceSimulation(nodes, 3)
    .force("link", link)
    .force("charge", d3.forceManyBody().strength((node) => chargeStrength(node) * 2.2))
    .force("ax", d3.forceX().x((node) => anchorForNode(node).x).strength(0.18))
    .force("ay", d3.forceY().y((node) => anchorForNode(node).y).strength(0.18))
    .force("az", d3.forceZ().z((node) => anchorForNode(node).z).strength(0.18))
    .force("collide", d3.forceCollide().radius((node) => (node.size || 6) + 2).strength(0.7))
    .alphaDecay(0.018)
    .alphaMin(0.008)
    .velocityDecay(0.45);
  return attachRandomSource(sim, random);
}

function buildCommunities(d3, nodes, edges, options) {
  const random = options.random;
  const chargeStrength = options.chargeStrength || defaultChargeStrength;
  const labels = runLabelPropagation(nodes, edges, { random, maxIters: options.maxIters ?? 8 });
  const communityIds = [...new Set(labels.values())];
  const radius = options.radius ?? Math.max(800, Math.sqrt(nodes.length || 1) * 30);
  const anchors = fibonacciSphere(communityIds.length, radius);
  const anchorByCommunity = new Map(communityIds.map((id, index) => [id, anchors[index]]));
  const anchorForNode = (node) => anchorByCommunity.get(labels.get(node.id)) || { x: 0, y: 0, z: 0 };

  for (const node of nodes) {
    const anchor = anchorForNode(node);
    node.x = anchor.x + (random() - 0.5) * 220;
    node.y = anchor.y + (random() - 0.5) * 220;
    node.z = anchor.z + (random() - 0.5) * 220;
    resetVelocity(node);
  }

  const link = d3.forceLink(edges).id((node) => node.id)
    .strength((edge) => {
      const same = labels.get(endpointNodeId(edge, "source")) === labels.get(endpointNodeId(edge, "target"));
      return (same ? 0.08 : 0.005) * (edge.weight || 1);
    })
    .distance((edge) => 70 / Math.max(0.3, edge.weight || 1));

  const sim = d3.forceSimulation(nodes, 3)
    .force("link", link)
    .force("charge", d3.forceManyBody().strength((node) => chargeStrength(node) * 2.0))
    .force("ax", d3.forceX().x((node) => anchorForNode(node).x).strength(0.18))
    .force("ay", d3.forceY().y((node) => anchorForNode(node).y).strength(0.18))
    .force("az", d3.forceZ().z((node) => anchorForNode(node).z).strength(0.18))
    .force("collide", d3.forceCollide().radius((node) => (node.size || 6) + 2).strength(0.7))
    .alphaDecay(0.022)
    .alphaMin(0.012)
    .velocityDecay(0.46);
  return attachRandomSource(sim, random);
}

function buildCore(d3, nodes, edges, options) {
  const random = options.random;
  const chargeStrength = options.chargeStrength || defaultChargeStrength;
  const coreness = computeKCore(nodes, edges);
  let maxCore = 0;
  for (const value of coreness.values()) maxCore = Math.max(maxCore, value);
  const baseRadius = options.radius ?? Math.max(500, Math.sqrt(nodes.length || 1) * 18);
  const shellRadius = (value) => {
    if (maxCore === 0) return baseRadius;
    const t = 1 - value / maxCore;
    return baseRadius * (0.25 + t * 1.55);
  };

  for (const node of nodes) {
    const radius = shellRadius(coreness.get(node.id) || 0);
    const phi = Math.acos(1 - 2 * random());
    const theta = 2 * Math.PI * random();
    node.x = radius * Math.sin(phi) * Math.cos(theta);
    node.y = radius * Math.sin(phi) * Math.sin(theta);
    node.z = radius * Math.cos(phi);
    resetVelocity(node);
  }

  const link = d3.forceLink(edges).id((node) => node.id)
    .strength((edge) => 0.04 * (edge.weight || 1))
    .distance((edge) => 80 / Math.max(0.3, edge.weight || 1));
  const sim = d3.forceSimulation(nodes, 3)
    .force("link", link)
    .force("charge", d3.forceManyBody().strength((node) => chargeStrength(node) * 1.5))
    .force("radial", d3.forceRadial((node) => shellRadius(coreness.get(node.id) || 0), 0, 0, 0).strength(0.22))
    .force("collide", d3.forceCollide().radius((node) => (node.size || 6) + 2).strength(0.6))
    .alphaDecay(0.025)
    .alphaMin(0.012)
    .velocityDecay(0.48);
  return attachRandomSource(sim, random);
}

export function createForceLayout3D({ d3 = defaultD3, nodes, edges, layout = "default", seed = "3dgraph", ...options }) {
  requireD3(d3);
  const random = options.random || createSeededRandom(seed);
  const args = [d3, nodes, edges, { ...options, random }];
  switch (layout) {
    case "galaxies":
      return buildGalaxies(...args);
    case "communities":
      return buildCommunities(...args);
    case "core":
      return buildCore(...args);
    case "default":
      return buildDefault(...args);
    default:
      throw new RangeError(`unknown 3dGraph layout: ${layout}`);
  }
}
