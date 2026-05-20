# JSON Data Example

This example loads `public/graph.json` through Vite's static asset pipeline,
validates it with `validateGraphData()`, and renders it with `create3dGraph()`.

```bash
npm run dev:json
npm run build:example:json
```

The detail panel is deliberately outside the renderer. It uses
`describeGraph()`, `describeNode()`, `traversalCandidates()`, `graph.model`,
and `graph.flyToNode()` to show the pattern consumer apps should copy for
labels, linked records, and accessible summaries.
