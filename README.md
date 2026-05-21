# 3dGraph

3dGraph is a Three.js knowledge-graph exploration library with force-directed
3D layouts, instanced node rendering, screen-space selection, selected/focus
state, projectile shooting, orbit/look controls, animated node travel, and 6DoF
flight mode.

The public repo is pre-release, but the first path renders a graph and the
examples cover generated and real JSON data.

## Install

Until the first npm release, pin an exact GitHub commit SHA for reproducible
installs:

```bash
npm install github:a-funk/3dGraph#8e5bb620eb3ea314a78ae077eef17453745fe64b
```

Installing the moving default branch also works for experiments, but your
lockfile may keep an older commit until you update it explicitly:

```bash
npm install github:a-funk/3dGraph
```

After npm publication, use the package release:

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
graph.shoot({ flyTo: true }); // fires from the reticle at the centered node
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
counts, flight mode, shoot/select, animated travel, and focus-neighborhood mode.

## JSON Data Demo

```bash
npm run dev:json
npm run build:example:json
```

This example fetches `examples/json/public/graph.json`, validates it with
`validateGraphData`, renders it, and keeps working after `vite build`.

See [examples/json/README.md](examples/json/README.md) for the external detail
panel pattern.

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
| `style.edge` | Per-edge style callback for color, opacity, and semantic weight. |
| `flight` | `false` to disable, or `{ pointerLock, speed }`. |
| `projectile` | Projectile color and opacity defaults. |
| `nodeScale` | Multiplies graph node sizes for the renderer. |
| `onSelect` | Node selection callback. |
| `onHover` | Node hover callback. |
| `onShoot` | Called when `shoot()` fires. |
| `onProjectileHit` | Called when a projectile reaches a node. |
| `onProjectileMiss` | Called when a projectile misses the graph. |

Controller methods:

```js
graph.setData(data);
graph.generate({ preset: "mesh", nodeCount: 500 });
graph.setLayout("galaxies");
graph.focusNode("node-42");
graph.flyToNode("node-42", { durationMs: 900 });
graph.setFocus("node-42", { depth: 2, flyTo: true });
graph.clearFocus();
graph.selectNode("node-42");
graph.clearSelection();
graph.pickNodeAtCenter();
graph.shoot({ flyTo: true });
graph.getState();
graph.resize();
graph.destroy();
```

### Interaction Model

The renderer has the same split that made the original Toto graph feel good:

- **Selection** is detail-panel state. `selectNode(id)`, `clearSelection()`,
  `getSelectedNode()`, and `onSelect(node | null)` own it.
- **Focus** is graph-neighborhood state. `setFocus(id, { depth })` shows only
  nodes within the requested hop depth; `clearFocus()` restores the full graph.
- **Animated travel** is camera state. `flyToNode(id, { durationMs, easing })`
  moves the camera to a node without making consumers touch internals.
- **Picking** is public. `pickNode(x, y)`, `pickNode({ clientX, clientY })`,
  and `pickNodeAtCenter()` use screen-space hit testing with forgiving targets.
- **Shooting** is public. `shoot()` fires a small projectile from the lower
  screen reticle toward the centered node. Hits can select/focus/fly; misses
  invoke `onProjectileMiss`.

Orbit controls are production-derived:

- Drag with a selected node orbits around that node.
- Drag with no selected node looks around in place.
- `Shift + drag` also looks around.
- Wheel zooms when nothing is selected.
- Wheel pitches around the selected node when a node is selected.
- Horizontal wheel yaw-orbits.

Flight controls are exposed on `graph.flight`:

```js
graph.flight.enter();
graph.flight.exit();
graph.flight.setSpeed(2);
```

Default keys: `WASD` move, `Space/C` up/down, `Q/E` roll, `Shift` sprint,
`Escape` exit.

In flight mode, left-click calls `shoot({ select: true, flyTo: true })`. That is
the stable public version of the original Toto graph's shoot-to-select behavior.

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

### Custom data

Consumer apps adapt their own domain objects into the plain graph contract, then
validate before rendering:

```js
import { create3dGraph, validateGraphData } from "@a-funk/3d-graph";

const data = await fetch("/graph.json").then((res) => res.json());
const validation = validateGraphData(data);

if (!validation.valid) {
  throw new Error(validation.errors.join("\\n"));
}

const graph = create3dGraph({
  container: document.getElementById("graph"),
  data,
  style: {
    edge(edge, base) {
      if (edge.kind === "wikilink") return { ...base, color: "#c89aff", opacity: 0.75 };
      return base;
    }
  }
});
```

### External detail panels

3dGraph keeps product UI outside the renderer. Use `onSelect()` and the graph
model to render ordinary HTML panels, labels, links, and traversal buttons:

```js
import { create3dGraph, describeNode, traversalCandidates } from "@a-funk/3d-graph";

const graph = create3dGraph({
  container,
  data,
  onSelect(node) {
    panel.textContent = node ? describeNode(node, graph.model) : "No node selected";
    neighborList.replaceChildren(
      ...traversalCandidates(node, graph.model).map((candidate) => {
        const button = document.createElement("button");
        button.textContent = candidate.label;
        button.addEventListener("click", () => graph.flyToNode(candidate.id));
        return button;
      })
    );
  }
});
```

### Accessibility helpers

Canvas content should be paired with app-owned HTML. 3dGraph exports
`graphStats()`, `describeGraph()`, `describeNode()`, and
`traversalCandidates()` so consumers can expose selection and navigation state
in accessible panels. `traversalStep()` adds pure cursor math for keyboard
neighbor navigation without taking over DOM events. See
[docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).

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
`opacity`, and `data`. Edge `color` and `opacity` are rendered per edge;
`weight` is preserved for layout/style callbacks because portable WebGL line
width support is inconsistent across browsers.

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
npm run smoke:consumer
npm run smoke:visual
npm run dev
npm run build:example
npm run build:example:json
```

For common setup issues, see [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).
For release gates, see [docs/RELEASE.md](docs/RELEASE.md).
