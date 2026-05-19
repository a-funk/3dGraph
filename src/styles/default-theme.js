export const defaultTheme = {
  background: "#0c0d10",
  foreground: "#e7e9ee",
  accent: "#ff7b3a",
  node: {
    color: "#88b4ff",
    colorByType: {
      concept: "#c89aff",
      cluster: "#ffb96b",
      document: "#69a9ff",
      meta: "#7ee0a8",
      node: "#88b4ff",
      tag: "#7ee0a8",
    },
    geometryByType: {
      cluster: "cube",
      concept: "octahedron",
      meta: "tetrahedron",
      tag: "tetrahedron",
    },
    defaultGeometry: "sphere",
    size: 4,
  },
  edge: {
    color: "#6f7786",
    opacity: 0.5,
  },
};

export function geometryForNode(node, theme = defaultTheme) {
  return node.geometry
    || theme.node.geometryByType[node.type]
    || theme.node.defaultGeometry;
}

export function resolveNodeStyle(node, theme = defaultTheme) {
  return {
    color: node.color || theme.node.colorByType[node.type] || theme.node.color,
    geometry: geometryForNode(node, theme),
    size: node.size || theme.node.size,
    opacity: node.hidden ? 0 : 1,
  };
}

export function resolveEdgeStyle(edge, theme = defaultTheme) {
  return {
    color: edge.color || theme.edge.color,
    opacity: edge.hidden ? 0 : theme.edge.opacity,
    weight: edge.weight || 1,
  };
}
