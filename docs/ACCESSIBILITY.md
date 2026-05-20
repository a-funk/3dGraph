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

## Keyboard Traversal

Keep keyboard policy in your app, then use `traversalStep()` for cursor math:

```js
import { describeNode, traversalStep } from "@a-funk/3d-graph";

let activeNeighborId = null;

graphContainer.addEventListener("keydown", (event) => {
  const selected = graph.getSelectedNode();
  if (!selected) return;

  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const step = traversalStep(selected.id, graph.model, {
      activeId: activeNeighborId,
      direction: event.key === "ArrowLeft" ? "previous" : "next"
    });
    activeNeighborId = step.candidate?.id || null;
    liveRegion.textContent = step.candidate
      ? describeNode(step.candidate.node, graph.model)
      : "No connected nodes";
  }

  if (event.key === "Enter" && activeNeighborId) {
    graph.flyToNode(activeNeighborId);
  }
});
```

Recommended app behavior:

- Keep graph controls as real buttons, inputs, or links outside the canvas.
- Put a live region near the graph for selection summaries.
- Mirror selected node state in text, not only color or camera position.
- Provide keyboard-reachable traversal targets using `traversalCandidates()` or
  `traversalStep()`.
- Keep domain links, record previews, and destructive actions in app-owned UI.
