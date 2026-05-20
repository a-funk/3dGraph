# Troubleshooting

## Blank Canvas

`create3dGraph()` needs a container with non-zero width and height. Give the
container stable dimensions before mounting the graph:

```html
<div id="graph" style="width: 100vw; height: 100vh"></div>
```

If a graph is mounted inside a tab, split pane, modal, or resizable shell, call
`graph.resize()` after that surface becomes visible.

## Static JSON Does Not Load

When using Vite, put static files in the example or app `public/` directory and
fetch them by root path:

```js
const data = await fetch("/graph.json").then((res) => res.json());
```

Validate before rendering so broken adapters fail loudly:

```js
const validation = validateGraphData(data);
if (!validation.valid) throw new Error(validation.errors.join("\n"));
```

## WebGL Is Unavailable

The renderer uses Three.js and WebGL. If the browser or environment cannot
create a WebGL context, test in a hardware-accelerated desktop browser first.
For CI, use a real browser smoke test instead of treating jsdom as a rendering
environment.

## Dense Graphs Are Hard To Read

Start with fewer visible nodes, then add navigation affordances:

- Use `graph.setFocus(id, { depth: 1 })` or `{ depth: 2 }` for local
  neighborhoods.
- Lower non-primary edge opacity with `style.edge`.
- Color edges by `kind` and nodes by `type`.
- Prefer `"communities"` or `"core"` layouts for mixed knowledge graphs.
- Hide archived or low-value records in your adapter before passing data to
  the renderer.

## Shoot Or Click Misses A Node

Picking is screen-space based and accepts `{ tolerancePx }`:

```js
const node = graph.pickNodeAtCenter({ tolerancePx: 34 });
```

For flight-first interfaces, use `graph.shoot({ select: true, flyTo: true })`.
The projectile reports misses through `onProjectileMiss`, so your UI can keep
selection state honest.

## Detail Panels And Tooltips

3dGraph intentionally keeps product UI outside the renderer. Use `onSelect()`
to drive an external panel, then query the model:

```js
const graph = create3dGraph({
  container,
  data,
  onSelect(node) {
    panel.textContent = node
      ? `${node.label} has ${graph.model.degree(node.id)} links`
      : "No node selected";
  }
});
```

The JSON example shows a fuller pattern with neighbor buttons and accessible
descriptions.

## Lockfile Still Uses An Old Commit

Before the first npm release, install with an exact GitHub commit SHA:

```bash
npm install github:a-funk/3dGraph#<commit-sha>
```

If you installed the moving default branch, your package manager may keep the
old commit in the lockfile. Update the dependency explicitly, or replace the
lockfile entry with a pinned SHA.
