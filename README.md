# 3dGraph

3dGraph is a Three.js knowledge-graph exploration library with force-directed
3D layouts, instanced node rendering, screen-space selection, orbit controls,
and 6DoF flight mode.

The public repo is pre-release, but the first path now renders a graph.

## Install

Until the first npm release:

```bash
npm install github:a-funk/3dGraph
```

After publish:

```bash
npm install @a-funk/3d-graph
```

`three` and `d3-force-3d` are regular dependencies, so the quickstart does not
make you install or inject a separate 3D stack.

## Quickstart

```js
import { create3dGraph, generateGraphData } from "@a-funk/3d-graph";

const graph = create3dGraph({
  container: document.getElementById("graph"),
  data: generateGraphData({
    preset: "knowledge",
    nodeCount: 240,
    clusters: 8,
    edgeDensity: 0.08,
    seed: "readme"
  }),
  layout: "communities",
  flight: {
    pointerLock: true,
    speed: 1.2
  },
  onSelect(node) {
    console.log(node);
  }
});

graph.focusNode("cluster-0");
```

Add a container:

```html
<div id="graph" style="width: 100vw; height: 100vh"></div>
```

## Vanilla Demo

```bash
npm install
npm run dev
```

The demo renders generated graphs and lets you switch presets, layouts, node
counts, and flight mode.

## API Surface

### `create3dGraph(options)`

Mounts a Three.js scene and returns a controller.

Useful options:

| Option | Purpose |
| --- | --- |
| `container` | Required DOM element for the WebGL canvas. |
| `data` | Plain `{ nodes, edges }` graph data. |
| `generate` | Fixture-generation options used when `data` is omitted. |
| `layout` | `"default"`, `"galaxies"`, `"communities"`, or `"core"`. |
| `theme` | Background, node, edge, and accent defaults. |
| `style.node` | Per-node style callback for color, size, and geometry. |
| `style.edge` | Per-edge style callback. |
| `flight` | `false` to disable, or `{ pointerLock, speed }`. |
| `nodeScale` | Multiplies graph node sizes for the renderer. |
| `onSelect` | Node selection callback. |
| `onHover` | Node hover callback. |

Controller methods:

```js
graph.setData(data);
graph.generate({ preset: "mesh", nodeCount: 500 });
graph.setLayout("galaxies");
graph.focusNode("node-42");
graph.selectNode("node-42");
graph.clearSelection();
graph.resize();
graph.destroy();
```

Flight controls are exposed on `graph.flight`:

```js
graph.flight.enter();
graph.flight.exit();
graph.flight.setSpeed(2);
```

Default keys: `WASD` move, `Space/C` up/down, `Q/E` roll, `Shift` sprint,
`Escape` exit.

### `generateGraphData(options)`

Creates useful demo data without any product adapter.

```js
generateGraphData({
  preset: "constellation",
  nodeCount: 300,
  clusters: 12,
  edgeDensity: 0.1,
  seed: "stable"
});
```

Presets:

- `knowledge`
- `clusters`
- `constellation`
- `tree`
- `mesh`

### `createForceLayout3D(options)`

Creates a d3-force-3d simulation. You can use it directly, but `create3dGraph`
uses it for you.

```js
const sim = createForceLayout3D({
  nodes,
  edges,
  layout: "core",
  seed: "stable"
});
```

## Data Contract

```js
const data = {
  nodes: [
    { id: "paper:attention", label: "Attention Is All You Need", type: "document" },
    { id: "concept:transformers", label: "Transformers", type: "concept" }
  ],
  edges: [
    { source: "paper:attention", target: "concept:transformers", kind: "mentions", weight: 2 }
  ]
};
```

Known node fields are `id`, `label`, `type`, `subtype`, `groupId`, `parentId`,
`color`, `geometry`, `size`, `x`, `y`, `z`, `hidden`, `arrivalTime`, and `data`.
Known edge fields are `source`, `target`, `kind`, `weight`, `hidden`, `color`,
and `data`.

## Boundary

3dGraph owns rendering, layout, picking, focus, controls, graph generation,
and style hooks.

Consumers own data fetching, auth, persistence, detail panels, product links,
and adapters from their domain objects into graph nodes and edges. The library
does not require a server, a token, browser storage, frame messaging, or product
specific URLs.

## Development

```bash
npm install
npm test
npm run dev
npm run build:example
```
