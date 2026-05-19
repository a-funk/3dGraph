export type GraphNode = {
  id: string | number;
  label?: string;
  type?: string;
  subtype?: string;
  groupId?: string;
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
  d3: unknown;
  nodes: NormalizedNode[];
  edges: NormalizedEdge[];
  layout?: "default" | "galaxies" | "communities" | "core";
  seed?: string;
  radius?: number;
  random?: () => number;
  chargeStrength?: (node: NormalizedNode) => number;
}): unknown;

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

export const defaultTheme: Record<string, unknown>;
export function geometryForNode(node: GraphNode, theme?: Record<string, unknown>): string;
export function resolveNodeStyle(node: GraphNode, theme?: Record<string, unknown>): Record<string, unknown>;
export function resolveEdgeStyle(edge: GraphEdge, theme?: Record<string, unknown>): Record<string, unknown>;
