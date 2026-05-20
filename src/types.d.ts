export type GraphNode = {
  id: string | number;
  label?: string;
  type?: string;
  subtype?: string;
  groupId?: string;
  parentId?: string;
  color?: string;
  geometry?: "sphere" | "cube" | "octahedron" | "tetrahedron" | string;
  size?: number;
  x?: number;
  y?: number;
  z?: number;
  hidden?: boolean;
  arrivalTime?: number;
  degree?: number;
  data?: unknown;
};

export type GraphEdge = {
  source: string | number | GraphNode;
  target: string | number | GraphNode;
  kind?: string;
  weight?: number;
  hidden?: boolean;
  color?: string;
  opacity?: number;
  data?: unknown;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type NormalizedNode = Required<Pick<GraphNode, "id" | "label" | "type" | "size" | "hidden">> & Omit<GraphNode, "id" | "label" | "type" | "size" | "hidden">;
export type NormalizedEdge = Required<Pick<GraphEdge, "source" | "target" | "kind" | "weight" | "hidden">> & Omit<GraphEdge, "source" | "target" | "kind" | "weight" | "hidden">;

export type GraphValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateGraphData(data: GraphData, options?: { allowDanglingEdges?: boolean }): GraphValidation;
export function normalizeGraphData(data: GraphData, options?: { allowDanglingEdges?: boolean; throwOnError?: boolean }): {
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  nodeById: Map<string, NormalizedNode>;
  warnings: string[];
};

export function createGraphModel(data: GraphData, options?: { allowDanglingEdges?: boolean }): {
  readonly nodes: NormalizedNode[];
  readonly edges: NormalizedEdge[];
  readonly warnings: string[];
  setData(data: GraphData): unknown;
  getNode(id: string | number): NormalizedNode | undefined;
  degree(id: string | number): number;
  neighbors(id: string | number): string[];
  visibleNodes(): NormalizedNode[];
  visibleEdges(): NormalizedEdge[];
  toJSON(): { nodes: NormalizedNode[]; edges: NormalizedEdge[] };
};

export const LAYOUT_VARIANTS: readonly ["default", "galaxies", "communities", "core"];
export function createSeededRandom(seed?: string): () => number;
export function hashUnit(value: unknown): number;
export function fibonacciSphere(count: number, radius?: number): Array<{ x: number; y: number; z: number }>;
export function degreeMap(nodes: NormalizedNode[], edges: NormalizedEdge[]): Map<string, number>;
export function runLabelPropagation(nodes: NormalizedNode[], edges: NormalizedEdge[], options?: { maxIters?: number; seed?: string; random?: () => number }): Map<string, string>;
export function computeKCore(nodes: NormalizedNode[], edges: NormalizedEdge[]): Map<string, number>;
export function createForceLayout3D(options: {
  d3?: unknown;
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  layout?: "default" | "galaxies" | "communities" | "core";
  seed?: string;
  radius?: number;
  random?: () => number;
  chargeStrength?: (node: NormalizedNode) => number;
}): unknown;

export type GenerationPreset = "knowledge" | "clusters" | "constellation" | "tree" | "mesh";
export const GENERATION_PRESETS: readonly GenerationPreset[];
export function generateGraphData(options?: {
  preset?: GenerationPreset;
  nodeCount?: number;
  nodes?: number;
  clusters?: number;
  edgeDensity?: number;
  seed?: string;
  random?: () => number;
}): GraphData;

export type FlightKeyIntent = "forward" | "backward" | "left" | "right" | "up" | "down" | "rollLeft" | "rollRight" | "sprint" | "exit";
export type FlightKeymap = Record<FlightKeyIntent, string[]>;
export const DEFAULT_FLIGHT_KEYMAP: FlightKeymap;
export function keyIntentForCode(code: string, keymap?: FlightKeymap): FlightKeyIntent | null;
export function isFlightControlKey(code: string, keymap?: FlightKeymap): boolean;
export function createFlightControls(options: Record<string, unknown>): FlightControls;

export class FlightControls {
  constructor(options?: Record<string, unknown>);
  bind(): this;
  dispose(): void;
  enter(state?: Record<string, unknown>): boolean;
  exit(options?: { releasePointerLock?: boolean }): boolean;
  clearInput(): void;
  handleKeyDown(event: KeyboardEvent): boolean;
  handleKeyUp(event: KeyboardEvent): boolean;
  handleMouseMove(event: MouseEvent): boolean;
  hasMovementIntent(): boolean;
  setSpeed(multiplier: number): this;
  setScaleMode(mode: "tiny" | "big" | string): this;
  setState(state?: Record<string, unknown>): this;
  getState(): Record<string, unknown>;
  update(options?: { radius?: number; dt?: number }): boolean;
}

export type TourWaypoint = {
  position: [number, number, number] | { x: number; y: number; z: number };
  lookAt: [number, number, number] | { x: number; y: number; z: number };
  durationMs?: number;
  duration?: number;
};
export function smootherstep(t: number): number;
export function createTour(waypoints: TourWaypoint[], options?: { durationMs?: number; easing?: "linear" | "smootherstep" | string }): {
  waypoints: Array<{ position: [number, number, number]; lookAt: [number, number, number]; durationMs: number }>;
  durationMs: number;
  easing: string;
};
export function sampleTour(tour: ReturnType<typeof createTour>, progress: number): {
  position: [number, number, number];
  lookAt: [number, number, number];
  progress: number;
};

export type NodeGeometry = "sphere" | "cube" | "octahedron" | "tetrahedron" | string;

export type NodeStyle = {
  color?: string;
  geometry?: NodeGeometry;
  size?: number;
  opacity?: number;
};

export type EdgeStyle = {
  color?: string;
  opacity?: number;
  weight?: number;
};

export type GraphTheme = {
  background?: string;
  foreground?: string;
  accent?: string;
  node?: {
    color?: string;
    colorByType?: Record<string, string>;
    geometryByType?: Record<string, NodeGeometry>;
    defaultGeometry?: NodeGeometry;
    size?: number;
  };
  edge?: {
    color?: string;
    opacity?: number;
  };
} & Record<string, unknown>;

export type PickNodeOptions = {
  tolerancePx?: number;
};

export type ShootResult = {
  hit: boolean;
  node: NormalizedNode | null;
  target: unknown;
};

export type ShootOptions = PickNodeOptions & {
  x?: number;
  y?: number;
  clientX?: number;
  clientY?: number;
  startX?: number;
  startY?: number;
  startZ?: number;
  durationMs?: number;
  missDistance?: number;
  select?: boolean;
  focus?: boolean;
  flyTo?: boolean;
};

export type FlyToNodeOptions = {
  radius?: number;
  theta?: number;
  phi?: number;
  depth?: number | null;
  durationMs?: number;
  duration?: number;
  easing?: (t: number) => number;
  notify?: boolean;
  onComplete?: (node: NormalizedNode) => void;
};

export type FocusOptions = {
  depth?: number;
  select?: boolean;
  notify?: boolean;
  flyTo?: boolean;
  focusCamera?: boolean;
  radius?: number;
  durationMs?: number;
  duration?: number;
  easing?: (t: number) => number;
};

export type ThreeGraphState = {
  cameraMode: "orbit" | "flight";
  selectedId: string | null;
  selectedNode: NormalizedNode | null;
  focusId: string | null;
  focusDepth: number | null;
  hoverId: string | null;
  orbit: {
    target: unknown;
    radius: number;
    theta: number;
    phi: number;
  };
  flight: Record<string, unknown> | null;
};

export type Create3dGraphOptions = {
  container: HTMLElement;
  data?: GraphData;
  generate?: Parameters<typeof generateGraphData>[0];
  layout?: "default" | "galaxies" | "communities" | "core";
  layoutOptions?: Record<string, unknown>;
  seed?: string;
  theme?: GraphTheme;
  style?: {
    node?: (node: NormalizedNode, base: NodeStyle) => NodeStyle;
    edge?: (edge: NormalizedEdge, base: EdgeStyle) => EdgeStyle;
  };
  camera?: {
    fov?: number;
    radius?: number;
    minRadius?: number;
    maxRadius?: number;
    theta?: number;
    phi?: number;
    far?: number;
    position?: [number, number, number];
  };
  flight?: false | {
    pointerLock?: boolean;
    speed?: number;
    sprintMultiplier?: number;
  };
  projectile?: {
    color?: string;
    opacity?: number;
  };
  antialias?: boolean;
  alpha?: boolean;
  nodeScale?: number;
  maxPixelRatio?: number;
  powerPreference?: WebGLPowerPreference;
  onSelect?: (node: NormalizedNode | null) => void;
  onHover?: (node: NormalizedNode | null) => void;
  onShoot?: (result: ShootResult) => void;
  onProjectileHit?: (node: NormalizedNode) => void;
  onProjectileMiss?: (result: { point: unknown }) => void;
  onModeChange?: (mode: "orbit" | "flight") => void;
};

export class ThreeGraph {
  constructor(options: Create3dGraphOptions);
  readonly container: HTMLElement;
  readonly camera: unknown;
  readonly renderer: unknown;
  readonly scene: unknown;
  model: ReturnType<typeof createGraphModel>;
  readonly flight: FlightControls;
  cameraMode: "orbit" | "flight";
  pickNode(clientX: number, clientY: number, options?: PickNodeOptions): NormalizedNode | null;
  pickNode(point: { x?: number; y?: number; clientX?: number; clientY?: number }, options?: PickNodeOptions): NormalizedNode | null;
  pickNodeAtCenter(options?: PickNodeOptions): NormalizedNode | null;
  shoot(options?: ShootOptions): ShootResult;
  getState(): ThreeGraphState;
  getSelectedNode(): NormalizedNode | null;
  focusNode(id: string | number | NormalizedNode, options?: { radius?: number; notify?: boolean; depth?: number | null }): NormalizedNode | null;
  flyToNode(id: string | number | NormalizedNode, options?: FlyToNodeOptions): NormalizedNode | null;
  setFocus(id: string | number | NormalizedNode | null, options?: FocusOptions): NormalizedNode | this | null;
  clearFocus(): this;
  selectNode(id: string | number | NormalizedNode, options?: { notify?: boolean }): NormalizedNode | null;
  clearSelection(options?: { notify?: boolean }): void;
  setData(data: GraphData, options?: { layout?: "default" | "galaxies" | "communities" | "core"; layoutOptions?: Record<string, unknown> }): this;
  generate(options?: Parameters<typeof generateGraphData>[0] & { layout?: "default" | "galaxies" | "communities" | "core" }): this;
  setLayout(layout: "default" | "galaxies" | "communities" | "core", options?: Record<string, unknown>): this;
  resize(): this;
  destroy(): void;
}

export function create3dGraph(options: Create3dGraphOptions): ThreeGraph;

export const defaultTheme: Record<string, unknown>;
export function geometryForNode(node: GraphNode, theme?: Record<string, unknown>): string;
export function resolveNodeStyle(node: GraphNode, theme?: Record<string, unknown>): Record<string, unknown>;
export function resolveEdgeStyle(edge: GraphEdge, theme?: Record<string, unknown>): Record<string, unknown>;
