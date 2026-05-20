import * as THREE from "three";

import { createFlightControls } from "../controls/index.js";
import { generateGraphData } from "../generators/index.js";
import { createGraphModel } from "../graph/index.js";
import { createForceLayout3D } from "../layouts/index.js";
import { defaultTheme, resolveEdgeStyle, resolveNodeStyle } from "../styles/index.js";

const GEOMETRIES = {
  sphere: () => new THREE.SphereGeometry(1, 16, 12),
  cube: () => new THREE.BoxGeometry(1.7, 1.7, 1.7),
  octahedron: () => new THREE.OctahedronGeometry(1.35, 0),
  tetrahedron: () => new THREE.TetrahedronGeometry(1.45, 0),
};

function endpointId(value) {
  return value && typeof value === "object" ? value.id : value;
}

function mergeTheme(theme) {
  return {
    ...defaultTheme,
    ...theme,
    node: { ...defaultTheme.node, ...(theme?.node || {}) },
    edge: { ...defaultTheme.edge, ...(theme?.edge || {}) },
  };
}

function getSize(container) {
  return {
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
  };
}

function setVec3(target, value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  target.set(Number(source[0]) || 0, Number(source[1]) || 0, Number(source[2]) || 0);
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function safeNow() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function isSafeColorInput(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 0xffffff;
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  if (/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(text)) return true;
  if (Object.hasOwn(THREE.Color.NAMES, text.toLowerCase())) return true;
  return /^(?:rgb|rgba|hsl|hsla)\([\d\s,%.+-]+\)$/i.test(text);
}

export function resolveThreeColor(value, fallback = "#ffffff") {
  const color = new THREE.Color();
  const source = isSafeColorInput(value) ? value : fallback;
  try {
    color.set(source);
  } catch {
    color.set("#ffffff");
  }
  return color;
}

function colorKey(value, fallback) {
  return `#${resolveThreeColor(value, fallback).getHexString()}`;
}

export class ThreeGraph {
  constructor(options = {}) {
    if (!options.container) throw new TypeError("create3dGraph requires a container element");

    this.container = options.container;
    this.theme = mergeTheme(options.theme || {});
    this.onSelect = options.onSelect || null;
    this.onHover = options.onHover || null;
    this.onShoot = options.onShoot || null;
    this.onProjectileHit = options.onProjectileHit || null;
    this.onProjectileMiss = options.onProjectileMiss || null;
    this.style = options.style || {};
    this.nodeScale = options.nodeScale ?? 7;
    this.layoutName = options.layout || "default";
    this.seed = options.seed || "3dgraph";
    this.disposed = false;
    this.selectedId = null;
    this.focusId = null;
    this.focusDepth = null;
    this.focusReachable = null;
    this.hoverId = null;
    this.pools = new Map();
    this.lastFrameMs = safeNow();
    this.cameraAnimation = null;
    this.projectiles = [];
    this.pointer = { dragging: false, moved: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    this.orbit = {
      target: new THREE.Vector3(0, 0, 0),
      radius: options.camera?.radius || 4400,
      theta: options.camera?.theta || 0.8,
      phi: options.camera?.phi || 1.1,
      minRadius: options.camera?.minRadius || 80,
      maxRadius: options.camera?.maxRadius || 20000,
    };

    const data = options.data || generateGraphData(options.generate || {});
    this.model = createGraphModel(data);
    this.nodes = this.model.nodes;
    this.edges = this.model.edges;
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));

    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias !== false,
      alpha: options.alpha === true,
      powerPreference: options.powerPreference || "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(options.maxPixelRatio || 2, globalThis.devicePixelRatio || 1));
    this.renderer.setClearColor(resolveThreeColor(this.theme.background, defaultTheme.background), options.alpha === true ? 0 : 1);

    this.scene = new THREE.Scene();
    const { width, height } = getSize(this.container);
    this.camera = new THREE.PerspectiveCamera(options.camera?.fov || 55, width / height, 1, options.camera?.far || 50000);
    setVec3(this.camera.position, options.camera?.position, [0, 0, this.orbit.radius]);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.58));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(0.8, 1.2, 0.9);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x88b4ff, 0.35);
    rimLight.position.set(-1.2, -0.4, -0.8);
    this.scene.add(rimLight);

    this.edgeGeometry = new THREE.BufferGeometry();
    this.edgePositions = new Float32Array(Math.max(1, this.edges.length * 2 * 3));
    this.edgeColors = new Float32Array(Math.max(1, this.edges.length * 2 * 3));
    this.edgeGeometry.setAttribute("position", new THREE.BufferAttribute(this.edgePositions, 3));
    this.edgeGeometry.setAttribute("color", new THREE.BufferAttribute(this.edgeColors, 3));
    this.edgeMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
    });
    this.edgeLines = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
    this.edgeLines.frustumCulled = false;
    this.scene.add(this.edgeLines);

    this.projectileGeometry = new THREE.SphereGeometry(6, 10, 8);
    this.projectileMaterial = new THREE.MeshBasicMaterial({
      color: resolveThreeColor(options.projectile?.color || this.theme.accent, defaultTheme.accent),
      transparent: true,
      opacity: options.projectile?.opacity ?? 0.95,
    });

    this.container.appendChild(this.renderer.domElement);
    this.resize();
    this.applyOrbitCamera();
    this.createSimulation(options.layoutOptions || {});
    this.rebuildPools();
    this.bindEvents(options);

    this.flight = createFlightControls({
      THREE,
      camera: this.camera,
      domElement: this.renderer.domElement,
      autoBind: true,
      pointerLock: options.flight?.pointerLock !== false,
      enabled: options.flight !== false,
      speedMultiplier: options.flight?.speed || 1,
      sprintMultiplier: options.flight?.sprintMultiplier || 3,
      onModeChange: (mode) => {
        this.cameraMode = mode;
        if (mode === "orbit") this.syncOrbitFromCamera();
        options.onModeChange?.(mode);
      },
    });
    this.cameraMode = "orbit";

    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  createSimulation(layoutOptions = {}) {
    this.simulation?.stop?.();
    this.simulation = createForceLayout3D({
      nodes: this.nodes,
      edges: this.edges,
      layout: this.layoutName,
      seed: this.seed,
      ...layoutOptions,
    });
    this.simulation.on?.("tick.3dgraph", () => {
      this.updateInstances();
      this.updateEdges();
    });
    return this.simulation;
  }

  bindEvents(options) {
    this.bound = {
      resize: () => this.resize(),
      pointerdown: (event) => this.onPointerDown(event),
      pointermove: (event) => this.onPointerMove(event),
      pointerup: () => this.onPointerUp(),
      wheel: (event) => this.onWheel(event),
      click: (event) => this.onClick(event),
      keydown: (event) => this.onKeyDown(event, options),
    };
    globalThis.addEventListener?.("resize", this.bound.resize);
    const dom = this.renderer.domElement;
    dom.addEventListener("pointerdown", this.bound.pointerdown);
    dom.addEventListener("pointermove", this.bound.pointermove);
    dom.addEventListener("pointerup", this.bound.pointerup);
    dom.addEventListener("pointerleave", this.bound.pointerup);
    dom.addEventListener("wheel", this.bound.wheel, { passive: false });
    dom.addEventListener("click", this.bound.click);
    globalThis.addEventListener?.("keydown", this.bound.keydown);
  }

  rebuildPools() {
    for (const pool of this.pools.values()) {
      this.scene.remove(pool.mesh);
      pool.mesh.geometry.dispose();
      pool.mesh.material.dispose();
    }
    this.pools.clear();

    const groups = new Map();
    for (const node of this.nodes) {
      if (!this.isNodeVisible(node)) continue;
      const nodeStyle = this.nodeStyle(node);
      const geometry = GEOMETRIES[nodeStyle.geometry] ? nodeStyle.geometry : "sphere";
      const color = colorKey(nodeStyle.color, this.theme.node.color || defaultTheme.node.color);
      const key = `${geometry}:${color}`;
      if (!groups.has(key)) groups.set(key, { geometry, color, nodes: [] });
      groups.get(key).nodes.push(node);
    }

    for (const { geometry, color, nodes } of groups.values()) {
      const material = new THREE.MeshBasicMaterial({ color: resolveThreeColor(color, defaultTheme.node.color) });
      const mesh = new THREE.InstancedMesh(GEOMETRIES[geometry](), material, nodes.length);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.scene.add(mesh);
      this.pools.set(`${geometry}:${color}`, { mesh, nodes });
    }

    this.updateInstances();
    this.updateEdges();
  }

  nodeStyle(node) {
    const base = resolveNodeStyle(node, this.theme);
    return {
      ...base,
      ...(this.style.node ? this.style.node(node, base) : null),
    };
  }

  edgeStyle(edge) {
    const base = resolveEdgeStyle(edge, this.theme);
    return {
      ...base,
      ...(this.style.edge ? this.style.edge(edge, base) : null),
    };
  }

  isNodeVisible(node) {
    if (!node || node.hidden) return false;
    return !this.focusReachable || this.focusReachable.has(String(node.id));
  }

  isEdgeVisible(edge) {
    if (!edge || edge.hidden) return false;
    const source = this.nodeById.get(endpointId(edge.source));
    const target = this.nodeById.get(endpointId(edge.target));
    return this.isNodeVisible(source) && this.isNodeVisible(target);
  }

  updateInstances() {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    for (const pool of this.pools.values()) {
      for (let i = 0; i < pool.nodes.length; i++) {
        const node = pool.nodes[i];
        if (!this.isNodeVisible(node)) continue;
        const nodeStyle = this.nodeStyle(node);
        const selected = node.id === this.selectedId;
        const size = (nodeStyle.size || 1) * this.nodeScale * (selected ? 1.8 : 1);
        position.set(node.x || 0, node.y || 0, node.z || 0);
        scale.setScalar(size);
        matrix.compose(position, quaternion, scale);
        pool.mesh.setMatrixAt(i, matrix);
      }
      pool.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  updateEdges() {
    const needed = Math.max(1, this.edges.length * 2 * 3);
    if (needed > this.edgePositions.length) {
      this.edgePositions = new Float32Array(needed);
      this.edgeColors = new Float32Array(needed);
      this.edgeGeometry.setAttribute("position", new THREE.BufferAttribute(this.edgePositions, 3));
      this.edgeGeometry.setAttribute("color", new THREE.BufferAttribute(this.edgeColors, 3));
    }

    let offset = 0;
    let colorOffset = 0;
    for (const edge of this.edges) {
      if (!this.isEdgeVisible(edge)) continue;
      const source = this.nodeById.get(endpointId(edge.source));
      const target = this.nodeById.get(endpointId(edge.target));
      const edgeStyle = this.edgeStyle(edge);
      const edgeColor = resolveThreeColor(edgeStyle.color, this.theme.edge.color || defaultTheme.edge.color);
      const opacity = Math.max(0, Math.min(1, edgeStyle.opacity ?? this.theme.edge.opacity ?? 1));
      edgeColor.multiplyScalar(opacity);
      this.edgePositions[offset++] = source.x || 0;
      this.edgePositions[offset++] = source.y || 0;
      this.edgePositions[offset++] = source.z || 0;
      this.edgePositions[offset++] = target.x || 0;
      this.edgePositions[offset++] = target.y || 0;
      this.edgePositions[offset++] = target.z || 0;
      for (let i = 0; i < 2; i++) {
        this.edgeColors[colorOffset++] = edgeColor.r;
        this.edgeColors[colorOffset++] = edgeColor.g;
        this.edgeColors[colorOffset++] = edgeColor.b;
      }
    }
    this.edgeGeometry.setDrawRange(0, offset / 3);
    this.edgeGeometry.attributes.position.needsUpdate = true;
    this.edgeGeometry.attributes.color.needsUpdate = true;
  }

  applyOrbitCamera() {
    const phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbit.phi));
    const radius = Math.max(this.orbit.minRadius, Math.min(this.orbit.maxRadius, this.orbit.radius));
    this.orbit.phi = phi;
    this.orbit.radius = radius;
    const x = this.orbit.target.x + radius * Math.sin(phi) * Math.sin(this.orbit.theta);
    const y = this.orbit.target.y + radius * Math.cos(phi);
    const z = this.orbit.target.z + radius * Math.sin(phi) * Math.cos(this.orbit.theta);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(this.orbit.target);
  }

  syncOrbitFromCamera() {
    const offset = new THREE.Vector3().subVectors(this.camera.position, this.orbit.target);
    this.orbit.radius = Math.max(this.orbit.minRadius, offset.length());
    this.orbit.theta = Math.atan2(offset.x, offset.z);
    this.orbit.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / this.orbit.radius)));
  }

  onPointerDown(event) {
    if (this.cameraMode === "flight") {
      this.shoot({ select: true, flyTo: true });
      return;
    }
    this.pointer.dragging = true;
    this.pointer.moved = false;
    this.pointer.startX = event.clientX;
    this.pointer.startY = event.clientY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
    this.cameraAnimation = null;
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event) {
    if (this.cameraMode === "flight") return;
    if (!this.pointer.dragging) {
      const node = this.pickNode(event.clientX, event.clientY);
      if (node?.id !== this.hoverId) {
        this.hoverId = node?.id || null;
        this.onHover?.(node || null);
      }
      return;
    }
    const dx = event.clientX - this.pointer.lastX;
    const dy = event.clientY - this.pointer.lastY;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
    if (Math.abs(event.clientX - this.pointer.startX) + Math.abs(event.clientY - this.pointer.startY) > 6) {
      this.pointer.moved = true;
    }
    const selected = this.getSelectedNode();
    const sensitivity = 0.002;
    if (selected && !event.shiftKey) {
      this.orbit.target.set(selected.x || 0, selected.y || 0, selected.z || 0);
      this.orbit.theta -= dx * sensitivity;
      this.orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbit.phi + dy * sensitivity));
    } else {
      const cameraPosition = this.camera.position.clone();
      this.orbit.theta -= dx * sensitivity;
      this.orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbit.phi + dy * sensitivity));
      const sinPhi = Math.sin(this.orbit.phi);
      const dirFromTarget = new THREE.Vector3(
        sinPhi * Math.sin(this.orbit.theta),
        Math.cos(this.orbit.phi),
        sinPhi * Math.cos(this.orbit.theta),
      );
      this.orbit.target.copy(cameraPosition).addScaledVector(dirFromTarget, -this.orbit.radius);
    }
    this.applyOrbitCamera();
  }

  onPointerUp() {
    this.pointer.dragging = false;
  }

  onWheel(event) {
    if (this.cameraMode === "flight") return;
    event.preventDefault();
    this.cameraAnimation = null;
    if (this.selectedId) {
      this.orbit.phi = Math.max(0.05, Math.min(Math.PI - 0.05, this.orbit.phi + event.deltaY * 0.0025));
    } else {
      this.orbit.radius *= Math.exp(event.deltaY * 0.001);
    }
    if (event.deltaX) this.orbit.theta -= event.deltaX * 0.003;
    this.applyOrbitCamera();
  }

  onClick(event) {
    if (this.pointer.moved || this.cameraMode === "flight") return;
    const node = this.pickNode(event.clientX, event.clientY);
    if (!node) {
      this.clearSelection();
      return;
    }
    this.selectNode(node.id);
  }

  onKeyDown(event) {
    if (event.code === "KeyF" && this.selectedId) {
      this.focusNode(this.selectedId);
      event.preventDefault();
    }
    if (event.code === "Escape" && this.selectedId) {
      this.clearSelection();
      event.preventDefault();
    }
  }

  pickNode(clientX, clientY, options = {}) {
    if (typeof clientX === "object" && clientX !== null) {
      options = clientY || {};
      clientY = clientX.y ?? clientX.clientY;
      clientX = clientX.x ?? clientX.clientX;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const projected = new THREE.Vector3();
    let best = null;
    let bestDistance = Infinity;
    let bestDepth = Infinity;
    const tolerancePx = options.tolerancePx ?? 12;
    const halfH = rect.height / 2;
    const focalPx = halfH / Math.tan((this.camera.fov * Math.PI / 180) / 2);

    for (const node of this.nodes) {
      if (!this.isNodeVisible(node)) continue;
      projected.set(node.x || 0, node.y || 0, node.z || 0).project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const dx = projected.x - x;
      const dy = projected.y - y;
      const dist = Math.hypot(dx, dy);
      const worldPos = new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0);
      const worldRadius = (node.size || 4) * this.nodeScale;
      const screenRadiusPx = (worldRadius / Math.max(1, worldPos.distanceTo(this.camera.position))) * focalPx;
      const tolerance = Math.max(tolerancePx / Math.max(1, Math.min(rect.width, rect.height)), screenRadiusPx / Math.max(1, Math.min(rect.width, rect.height)));
      if (dist <= tolerance && (dist < bestDistance || projected.z < bestDepth)) {
        best = node;
        bestDistance = dist;
        bestDepth = projected.z;
      }
    }
    return best;
  }

  pickNodeAtCenter(options = {}) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return this.pickNode(rect.left + rect.width / 2, rect.top + rect.height / 2, options);
  }

  getSelectedNode() {
    return this.selectedId == null ? null : this.nodeById.get(this.selectedId) || null;
  }

  selectNode(id, options = {}) {
    const node = typeof id === "object" ? id : this.nodeById.get(String(id));
    if (!node) return null;
    this.selectedId = String(node.id);
    this.updateInstances();
    if (options.notify !== false) this.onSelect?.(node);
    return node;
  }

  clearSelection(options = {}) {
    this.selectedId = null;
    this.updateInstances();
    if (options.notify !== false) this.onSelect?.(null);
  }

  focusNode(id, options = {}) {
    const node = typeof id === "object" ? id : this.nodeById.get(String(id));
    if (!node) return null;
    if (this.cameraMode === "flight") this.flight.exit();
    const hadFocusFilter = this.focusReachable !== null;
    this.focusId = String(node.id);
    this.focusDepth = options.depth ?? null;
    this.focusReachable = this.focusDepth ? this.reachableFrom(node.id, this.focusDepth) : null;
    this.orbit.target.set(node.x || 0, node.y || 0, node.z || 0);
    this.orbit.radius = options.radius || Math.max(180, (node.size || 4) * 160);
    this.applyOrbitCamera();
    this.selectNode(node.id, { notify: options.notify });
    if (hadFocusFilter || this.focusReachable) this.rebuildPools();
    return node;
  }

  flyToNode(id, options = {}) {
    const node = typeof id === "object" ? id : this.nodeById.get(String(id));
    if (!node) return null;
    if (this.cameraMode === "flight") this.flight.exit();
    const target = new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0);
    const radius = options.radius || Math.max(180, (node.size || 4) * 160);
    const theta = options.theta ?? this.orbit.theta;
    const phi = options.phi ?? this.orbit.phi;
    const sinPhi = Math.sin(Math.max(0.05, Math.min(Math.PI - 0.05, phi)));
    const endPosition = new THREE.Vector3(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );
    const hadFocusFilter = this.focusReachable !== null;
    this.focusId = String(node.id);
    this.focusDepth = options.depth ?? null;
    this.focusReachable = this.focusDepth ? this.reachableFrom(node.id, this.focusDepth) : null;
    this.selectNode(node.id, { notify: options.notify });
    if (hadFocusFilter || this.focusReachable) this.rebuildPools();
    this.cameraAnimation = {
      type: "flyToNode",
      node,
      startMs: safeNow(),
      durationMs: Math.max(0, options.durationMs ?? options.duration ?? 700),
      startPosition: this.camera.position.clone(),
      endPosition,
      startTarget: this.orbit.target.clone(),
      endTarget: target,
      endRadius: radius,
      endTheta: theta,
      endPhi: phi,
      easing: options.easing || easeInOutQuad,
      onComplete: options.onComplete || null,
    };
    if (this.cameraAnimation.durationMs === 0) this.finishCameraAnimation(this.cameraAnimation);
    return node;
  }

  setFocus(id, options = {}) {
    if (id == null) return this.clearFocus();
    const node = typeof id === "object" ? id : this.nodeById.get(String(id));
    if (!node) return null;
    this.focusId = String(node.id);
    this.focusDepth = Math.max(1, Math.min(8, Number(options.depth ?? 2) || 2));
    this.focusReachable = this.reachableFrom(node.id, this.focusDepth);
    this.rebuildPools();
    if (options.select !== false) this.selectNode(node.id, { notify: options.notify });
    if (options.flyTo) this.flyToNode(node.id, { ...options, depth: this.focusDepth });
    else if (options.focusCamera) this.focusNode(node.id, { ...options, depth: this.focusDepth });
    return node;
  }

  clearFocus() {
    this.focusId = null;
    this.focusDepth = null;
    this.focusReachable = null;
    this.rebuildPools();
    return this;
  }

  reachableFrom(id, depth) {
    const start = String(typeof id === "object" ? id.id : id);
    const maxDepth = Math.max(1, Number(depth) || 1);
    const adjacency = new Map();
    for (const edge of this.edges) {
      if (edge.hidden) continue;
      const source = String(endpointId(edge.source));
      const target = String(endpointId(edge.target));
      if (!this.nodeById.has(source) || !this.nodeById.has(target)) continue;
      if (!adjacency.has(source)) adjacency.set(source, []);
      if (!adjacency.has(target)) adjacency.set(target, []);
      adjacency.get(source).push(target);
      adjacency.get(target).push(source);
    }
    const seen = new Set([start]);
    const queue = [{ id: start, depth: 0 }];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      if (current.depth >= maxDepth) continue;
      for (const next of adjacency.get(current.id) || []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
    return seen;
  }

  shoot(options = {}) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const clientX = options.x ?? options.clientX ?? rect.left + rect.width / 2;
    const clientY = options.y ?? options.clientY ?? rect.top + rect.height / 2;
    const node = this.pickNode(clientX, clientY, options);
    const startNdc = new THREE.Vector3(options.startX ?? 0, options.startY ?? -0.55, options.startZ ?? 0.92);
    const start = startNdc.unproject(this.camera);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const target = node
      ? new THREE.Vector3(node.x || 0, node.y || 0, node.z || 0)
      : this.camera.position.clone().addScaledVector(forward, options.missDistance || 3500);
    const durationMs = Math.max(0, options.durationMs ?? Math.min(900, Math.max(160, start.distanceTo(target) / 5)));
    const projectile = new THREE.Mesh(this.projectileGeometry, this.projectileMaterial.clone());
    projectile.frustumCulled = false;
    projectile.position.copy(start);
    this.scene.add(projectile);
    const result = { hit: Boolean(node), node: node || null, target: target.clone() };
    this.projectiles.push({
      mesh: projectile,
      start,
      target,
      node,
      startMs: safeNow(),
      durationMs,
      select: options.select !== false,
      flyTo: options.flyTo === true,
      focus: options.focus === true,
    });
    this.onShoot?.(result);
    if (durationMs === 0) this.updateProjectiles(safeNow());
    return result;
  }

  setData(data, options = {}) {
    this.model = createGraphModel(data);
    this.nodes = this.model.nodes;
    this.edges = this.model.edges;
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    this.selectedId = null;
    this.focusId = null;
    this.focusDepth = null;
    this.focusReachable = null;
    this.cameraAnimation = null;
    this.layoutName = options.layout || this.layoutName;
    this.createSimulation(options.layoutOptions || {});
    this.rebuildPools();
    return this;
  }

  generate(options = {}) {
    return this.setData(generateGraphData(options), { layout: options.layout });
  }

  setLayout(layout, options = {}) {
    this.layoutName = layout;
    this.createSimulation(options);
    return this;
  }

  resize() {
    const { width, height } = getSize(this.container);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    return this;
  }

  animate() {
    if (this.disposed) return;
    const now = safeNow();
    const dt = Math.max(0.001, Math.min(0.05, (now - this.lastFrameMs) / 1000));
    this.lastFrameMs = now;
    if (this.cameraMode === "flight") this.flight.update({ radius: this.orbit.radius, dt });
    this.updateCameraAnimation(now);
    this.updateProjectiles(now);
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(() => this.animate());
  }

  updateCameraAnimation(now) {
    const animation = this.cameraAnimation;
    if (!animation) return;
    const t = animation.durationMs <= 0 ? 1 : Math.min(1, (now - animation.startMs) / animation.durationMs);
    const eased = typeof animation.easing === "function" ? animation.easing(t) : easeInOutQuad(t);
    this.camera.position.copy(animation.startPosition).lerp(animation.endPosition, eased);
    this.orbit.target.copy(animation.startTarget).lerp(animation.endTarget, eased);
    this.camera.lookAt(this.orbit.target);
    if (t >= 1) this.finishCameraAnimation(animation);
  }

  finishCameraAnimation(animation) {
    this.orbit.target.copy(animation.endTarget);
    this.orbit.radius = animation.endRadius;
    this.orbit.theta = animation.endTheta;
    this.orbit.phi = animation.endPhi;
    this.applyOrbitCamera();
    this.cameraAnimation = null;
    animation.onComplete?.(animation.node);
  }

  updateProjectiles(now) {
    if (this.projectiles.length === 0) return;
    const remaining = [];
    for (const projectile of this.projectiles) {
      const t = projectile.durationMs <= 0 ? 1 : Math.min(1, (now - projectile.startMs) / projectile.durationMs);
      projectile.mesh.position.copy(projectile.start).lerp(projectile.target, easeInOutQuad(t));
      if (t < 1) {
        remaining.push(projectile);
        continue;
      }
      this.scene.remove(projectile.mesh);
      projectile.mesh.material?.dispose?.();
      if (projectile.node) {
        if (this.cameraMode === "flight") this.flight.exit();
        if (projectile.flyTo) this.flyToNode(projectile.node, { notify: projectile.select, durationMs: 700 });
        else if (projectile.focus) this.focusNode(projectile.node, { notify: projectile.select });
        else if (projectile.select) this.selectNode(projectile.node, { notify: true });
        this.onProjectileHit?.(projectile.node);
      } else {
        this.onProjectileMiss?.({ point: projectile.target.clone() });
      }
    }
    this.projectiles = remaining;
  }

  getState() {
    return {
      cameraMode: this.cameraMode,
      selectedId: this.selectedId,
      selectedNode: this.getSelectedNode(),
      focusId: this.focusId,
      focusDepth: this.focusDepth,
      hoverId: this.hoverId,
      orbit: {
        target: this.orbit.target.clone(),
        radius: this.orbit.radius,
        theta: this.orbit.theta,
        phi: this.orbit.phi,
      },
      flight: this.flight?.getState?.() || null,
    };
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.simulation?.stop?.();
    this.flight?.dispose?.();
    globalThis.removeEventListener?.("resize", this.bound.resize);
    globalThis.removeEventListener?.("keydown", this.bound.keydown);
    const dom = this.renderer.domElement;
    dom.removeEventListener("pointerdown", this.bound.pointerdown);
    dom.removeEventListener("pointermove", this.bound.pointermove);
    dom.removeEventListener("pointerup", this.bound.pointerup);
    dom.removeEventListener("pointerleave", this.bound.pointerup);
    dom.removeEventListener("wheel", this.bound.wheel);
    dom.removeEventListener("click", this.bound.click);
    for (const pool of this.pools.values()) {
      this.scene.remove(pool.mesh);
      pool.mesh.geometry.dispose();
      pool.mesh.material.dispose();
    }
    for (const projectile of this.projectiles) {
      this.scene.remove(projectile.mesh);
      projectile.mesh.material?.dispose?.();
    }
    this.projectiles = [];
    this.projectileGeometry.dispose();
    this.projectileMaterial.dispose();
    this.edgeGeometry.dispose();
    this.edgeMaterial.dispose();
    this.renderer.dispose();
    dom.remove();
  }
}

export function create3dGraph(options) {
  return new ThreeGraph(options);
}
