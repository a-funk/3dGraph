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

export class ThreeGraph {
  constructor(options = {}) {
    if (!options.container) throw new TypeError("create3dGraph requires a container element");

    this.container = options.container;
    this.theme = mergeTheme(options.theme || {});
    this.onSelect = options.onSelect || null;
    this.onHover = options.onHover || null;
    this.style = options.style || {};
    this.nodeScale = options.nodeScale ?? 7;
    this.layoutName = options.layout || "default";
    this.seed = options.seed || "3dgraph";
    this.disposed = false;
    this.selectedId = null;
    this.hoverId = null;
    this.pools = new Map();
    this.clock = new THREE.Clock();
    this.pointer = { dragging: false, lastX: 0, lastY: 0 };
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
    this.renderer.setClearColor(new THREE.Color(this.theme.background), options.alpha === true ? 0 : 1);

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
    this.edgeGeometry.setAttribute("position", new THREE.BufferAttribute(this.edgePositions, 3));
    const edgeStyle = resolveEdgeStyle({}, this.theme);
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: new THREE.Color(edgeStyle.color),
      transparent: edgeStyle.opacity < 1,
      opacity: edgeStyle.opacity,
    });
    this.edgeLines = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
    this.edgeLines.frustumCulled = false;
    this.scene.add(this.edgeLines);

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
      if (node.hidden) continue;
      const nodeStyle = this.nodeStyle(node);
      const geometry = GEOMETRIES[nodeStyle.geometry] ? nodeStyle.geometry : "sphere";
      const color = nodeStyle.color || this.theme.node.color;
      const key = `${geometry}:${color}`;
      if (!groups.has(key)) groups.set(key, { geometry, color, nodes: [] });
      groups.get(key).nodes.push(node);
    }

    for (const { geometry, color, nodes } of groups.values()) {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
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

  updateInstances() {
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();

    for (const pool of this.pools.values()) {
      for (let i = 0; i < pool.nodes.length; i++) {
        const node = pool.nodes[i];
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
      this.edgeGeometry.setAttribute("position", new THREE.BufferAttribute(this.edgePositions, 3));
    }

    let offset = 0;
    for (const edge of this.edges) {
      if (edge.hidden) continue;
      const source = this.nodeById.get(endpointId(edge.source));
      const target = this.nodeById.get(endpointId(edge.target));
      if (!source || !target || source.hidden || target.hidden) continue;
      this.edgePositions[offset++] = source.x || 0;
      this.edgePositions[offset++] = source.y || 0;
      this.edgePositions[offset++] = source.z || 0;
      this.edgePositions[offset++] = target.x || 0;
      this.edgePositions[offset++] = target.y || 0;
      this.edgePositions[offset++] = target.z || 0;
    }
    this.edgeGeometry.setDrawRange(0, offset / 3);
    this.edgeGeometry.attributes.position.needsUpdate = true;
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
    if (this.cameraMode === "flight") return;
    this.pointer.dragging = true;
    this.pointer.lastX = event.clientX;
    this.pointer.lastY = event.clientY;
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
    this.orbit.theta -= dx * 0.005;
    this.orbit.phi += dy * 0.005;
    this.applyOrbitCamera();
  }

  onPointerUp() {
    this.pointer.dragging = false;
  }

  onWheel(event) {
    if (this.cameraMode === "flight") return;
    event.preventDefault();
    this.orbit.radius *= Math.exp(event.deltaY * 0.001);
    this.applyOrbitCamera();
  }

  onClick(event) {
    if (this.pointer.dragging || this.cameraMode === "flight") return;
    const node = this.pickNode(event.clientX, event.clientY);
    if (!node) return;
    this.selectNode(node.id);
    this.onSelect?.(node);
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

  pickNode(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const projected = new THREE.Vector3();
    let best = null;
    let bestDistance = Infinity;
    let bestDepth = Infinity;

    for (const node of this.nodes) {
      if (node.hidden) continue;
      projected.set(node.x || 0, node.y || 0, node.z || 0).project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;
      const dx = projected.x - x;
      const dy = projected.y - y;
      const dist = Math.hypot(dx, dy);
      const tolerance = Math.max(0.018, ((node.size || 4) * this.nodeScale) / Math.max(240, this.orbit.radius));
      if (dist <= tolerance && (dist < bestDistance || projected.z < bestDepth)) {
        best = node;
        bestDistance = dist;
        bestDepth = projected.z;
      }
    }
    return best;
  }

  selectNode(id) {
    this.selectedId = String(id);
    this.updateInstances();
    return this.nodeById.get(this.selectedId) || null;
  }

  clearSelection() {
    this.selectedId = null;
    this.updateInstances();
  }

  focusNode(id, options = {}) {
    const node = typeof id === "object" ? id : this.nodeById.get(String(id));
    if (!node) return null;
    if (this.cameraMode === "flight") this.flight.exit();
    this.orbit.target.set(node.x || 0, node.y || 0, node.z || 0);
    this.orbit.radius = options.radius || Math.max(180, (node.size || 4) * 160);
    this.applyOrbitCamera();
    this.selectNode(node.id);
    return node;
  }

  setData(data, options = {}) {
    this.model = createGraphModel(data);
    this.nodes = this.model.nodes;
    this.edges = this.model.edges;
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
    this.selectedId = null;
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
    const dt = this.clock.getDelta();
    if (this.cameraMode === "flight") this.flight.update({ radius: this.orbit.radius, dt });
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(() => this.animate());
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
    this.edgeGeometry.dispose();
    this.edgeMaterial.dispose();
    this.renderer.dispose();
    dom.remove();
  }
}

export function create3dGraph(options) {
  return new ThreeGraph(options);
}
