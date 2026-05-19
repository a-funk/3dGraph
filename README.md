# 3dGraph

3dGraph is the extraction workspace for a reusable Three.js knowledge-graph
exploration library: dense graph layouts, instanced rendering, orbit/flight
navigation, screen-space selection, labels, focus, and cinematic tours.

This package is intentionally pre-release. The code here defines the library
boundary and extracts the first reusable seams without changing Toto's current
graph app.

## What Is In This Slice

- Generic graph data contract and validation.
- Graph model helpers for degree, neighbors, and visible subsets.
- Seeded graph analysis utilities: Fibonacci sphere points, label propagation,
  k-core decomposition, degree maps.
- d3-force-3d preset builders with explicit dependency injection.
- Standalone 6DoF flight controls that do not know about graph data.
- Generic tour sampling and default style hooks.
- Tests that keep the source free of Toto APIs, Obsidian links, default
  storage, and frame messaging.

## Boundary

3dGraph owns graph rendering, layout, picking, focus, controls, labels, tours,
and style hooks.

Consumers own data fetching, auth, persistence, detail panels, product links,
filters UI, and adapters from their domain objects into graph nodes and edges.

The package must not require a Toto account, a proxy server, browser storage,
product-specific URLs, or global `window.THREE` / `window.d3` objects.

## Data Contract

```js
const data = {
  nodes: [
    { id: "paper:attention", label: "Attention Is All You Need", type: "paper" },
    { id: "concept:transformers", label: "Transformers", type: "concept" }
  ],
  edges: [
    { source: "paper:attention", target: "concept:transformers", kind: "mentions", weight: 2 }
  ]
};
```

Known node fields are `id`, `label`, `type`, `subtype`, `groupId`, `color`,
`size`, `x`, `y`, `z`, `hidden`, `arrivalTime`, and `data`. Known edge fields
are `source`, `target`, `kind`, `weight`, `hidden`, and `data`.

## Current API

```js
import {
  createGraphModel,
  createForceLayout3D,
  createFlightControls,
  defaultTheme,
} from "@a-funk/3d-graph";

const model = createGraphModel(data);

const sim = createForceLayout3D({
  d3,
  nodes: model.nodes,
  edges: model.edges,
  layout: "communities",
  seed: "demo"
});

const controls = createFlightControls({
  THREE,
  camera,
  domElement: renderer.domElement,
  pointerLock: true
});
```

`createForceLayout3D` accepts an injected d3-force-3d compatible object. The
renderer extraction will make this direct for normal bundler users once the
package has its own build pipeline.

## v0.1 Target

- Three renderer with instanced node pools and dynamic edge buffers.
- Flight/orbit camera system extracted from the existing graph app.
- Screen-space picking, focus navigation, labels, and tours.
- Vanilla example with anonymized fixtures.
- Playwright WebGL smoke tests.
- Cold-clone install test before publish.

## Development

```bash
cd packages/3dgraph
npm test
```

The package is marked `private` until the release checklist is complete.
