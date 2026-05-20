# v0.3 Hardening Scorecard

This scorecard records the adversarial loop after v0.2. The prior scorecard
identified release-channel clarity, real JSON data, troubleshooting, detail
panel patterns, and accessibility guidance as the top DX gaps. v0.2 closed
those. v0.3 focuses on enforcing the loop.

| Stage | Score | Assessment |
| --- | ---: | --- |
| Boundary | 9/10 | Source remains free of product API, auth, storage, frame messaging, and private URL coupling. The existing coupling test still guards `src/`. |
| Hostile Data | 8/10 | Regression tests now cover reserved IDs, dangling edges, unsafe labels, cyclic metadata, giant payloads, large sparse graphs, and malformed color strings. Dense 50k edge visual behavior remains future performance work. |
| Security/Privacy | 8/10 | No `innerHTML`, telemetry, storage, or frame messaging. Renderer color inputs now validate/fallback before reaching Three.js. Examples still expose `globalThis.graph` for demos and smoke tests, so real apps should avoid copying that debug affordance. |
| DX | 8.5/10 | Clean `npm pack` consumer smoke installs the package into a temporary Vite app, checks root and subpath imports, runs a TypeScript compile, and builds. |
| Visual Verification | 7/10 | Playwright smoke now checks desktop/mobile nonblank WebGL rendering, detail-panel state, flight enter/exit, and destroy/recreate. Pointer-lock browser permission behavior is not fully asserted because headless Chromium may deny it. |

Overall v0.3 hardening: **8.1/10**.

## Remaining Gaps

- Add performance budgets for very dense graphs, not just large sparse
  normalization.
- Add optional bundle splitting guidance if package consumers need smaller
  initial chunks.
- Consider replacing `globalThis.graph` in examples with a documented debug-only
  flag before the first npm publish.
