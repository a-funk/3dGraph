# Changelog

## 0.3.0

- Added hostile-data regression tests for reserved IDs, unsafe labels, cyclic
  metadata, large sparse graphs, dangling-edge policies, and malformed colors.
- Added `traversalStep()` for app-owned keyboard traversal over neighboring
  graph nodes.
- Added clean consumer smoke coverage for npm-packed installs, subpath exports,
  Vite builds, and TypeScript type-checking without casts.
- Added GitHub Actions CI and Playwright visual smoke coverage for nonblank
  desktop/mobile WebGL rendering, flight enter/exit, and destroy/recreate.
- Hardened renderer color inputs so invalid node, edge, theme, and projectile
  colors fall back safely.

## 0.2.0

- Clarified pre-npm install guidance with exact GitHub commit pinning.
- Added a real JSON data Vite example that fetches `graph.json`, validates it,
  renders it, and demonstrates an external detail panel.
- Added accessibility helpers for graph summaries, node descriptions, and
  traversal candidate lists.
- Added troubleshooting guidance for blank canvases, static JSON, WebGL,
  dense graphs, picking, and lockfile drift.

## 0.1.0

- Added generic graph model helpers, 3D layout utilities, flight controls,
  tour helpers, styles, docs, and coupling tests.
- Added `create3dGraph()` with direct Three.js rendering, generated graph
  varieties, and a runnable vanilla Vite example.
- Added public picking, shoot-to-select projectiles, animated `flyToNode()`,
  selection/focus state, production-derived orbit/zoom behavior, and per-edge
  color/opacity rendering.
