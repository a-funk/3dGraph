# 3dGraph Coupling Inventory

This inventory gates extraction from the existing graph app into the reusable
3dGraph package.

## Core Library

| Capability | Current source | Extraction target |
| --- | --- | --- |
| Instanced 3D node rendering | `toto-graph/src/render3d.js` | `src/renderers/three` |
| 6DoF flight controls | `toto-graph/src/render3d.js` | `src/controls/flight.js` |
| Camera tours | `toto-graph/src/render3d.js` | `src/controls/tour.js` |
| 3D force layouts | `toto-graph/src/graph.js` | `src/layouts/force3d.js` |
| Graph analysis helpers | `toto-graph/src/graph.js` | `src/layouts/analysis.js` |
| Theme/style defaults | `toto-graph/src/colors.js` | `src/styles/default-theme.js` |

## Adapter Only

These concepts stay outside the package and belong to a consumer adapter:

- Fetching lists/items or any authenticated API.
- Product-specific transforms from lists, tasks, ideas, metadata, or files.
- Detail panels, links, sidebars, filters UI, and route state.
- Product demos, watchers, local cache keys, and launch choreography.
- Any server, proxy, token handling, or route integration.

## Must Remove Before Renderer Extraction

- `window.THREE` and `window.d3` globals.
- Fixed DOM IDs such as `flightHud`, `detail`, and `detailClose`.
- Private mutation fields such as `_hidden`, `_arrivalTime`, `_status`, and
  `_ideaId`; use documented public fields instead.
- Built-in browser storage or frame messaging.
- Any hard-coded product URL or local protocol link.

## Security Gate

The package must be a client-side rendering/control library. It should ship no
auth code, no telemetry, no default persistence, no proxy, and no network
behavior beyond what a consuming app explicitly provides.
