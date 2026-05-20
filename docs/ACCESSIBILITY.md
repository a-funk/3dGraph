# Accessibility

3dGraph renders the graph in WebGL, so consumer apps should pair the canvas
with ordinary HTML controls and summaries. The library provides small helpers
for that external UI:

```js
import {
  create3dGraph,
  describeGraph,
  describeNode,
  traversalCandidates
} from "@a-funk/3d-graph";

const graph = create3dGraph({
  container,
  data,
  onSelect(node) {
    summary.textContent = describeGraph(graph.model);
    detail.textContent = node ? describeNode(node, graph.model) : "No node selected";
  }
});

for (const candidate of traversalCandidates("node-a", graph.model)) {
  // Render a normal button or link that calls graph.flyToNode(candidate.id).
}
```

Recommended app behavior:

- Keep graph controls as real buttons, inputs, or links outside the canvas.
- Put a live region near the graph for selection summaries.
- Mirror selected node state in text, not only color or camera position.
- Provide keyboard-reachable traversal targets using `traversalCandidates()`.
- Keep domain links, record previews, and destructive actions in app-owned UI.
