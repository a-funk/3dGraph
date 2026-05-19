# Adversarial Build Loop

The 3dGraph extraction should run through a hostile loop before any public
publish.

## Stage 1: Boundary Review

- No product APIs, URLs, auth, proxy code, localStorage defaults, or Obsidian
  links in package source.
- No global `window.THREE` or `window.d3`; dependencies are imports or explicit
  injections.
- Public API accepts plain nodes and edges, not domain-specific records.

## Stage 2: Hostile Data

Use fixtures with:

- Duplicate node IDs.
- Dangling edges.
- HTML/script labels.
- Huge labels and metadata blobs.
- 50k nodes with sparse and dense edge sets.
- Cyclic object references in `data`.
- Missing optional fields.

## Stage 3: Security And Privacy

- No `innerHTML` for user-controlled labels.
- No default persistence of graph data.
- No third-party fonts, analytics, or telemetry in demos.
- Frame messaging, if added, must be opt-in and target-origin constrained.
- URL parameters must be validated before controlling graph behavior.

## Stage 4: DX

- `npm pack` install into a clean Vite app.
- Plain HTML example runs from a local server.
- TypeScript app imports types without casts.
- README quickstart renders a graph in under five minutes.

## Stage 5: Visual Verification

- Desktop and mobile Playwright screenshots.
- WebGL nonblank pixel checks.
- Pointer-lock enter/exit checks.
- Dispose/recreate loop to catch leaked resources.
