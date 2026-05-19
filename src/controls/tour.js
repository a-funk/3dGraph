export function smootherstep(t) {
  const x = Math.max(0, Math.min(1, Number(t) || 0));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

function toPoint(value, label) {
  if (Array.isArray(value) && value.length >= 3) {
    return [Number(value[0]) || 0, Number(value[1]) || 0, Number(value[2]) || 0];
  }
  if (value && typeof value === "object") {
    return [Number(value.x) || 0, Number(value.y) || 0, Number(value.z) || 0];
  }
  throw new TypeError(`${label} must be [x, y, z] or { x, y, z }`);
}

function lerpPoint(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

export function createTour(waypoints, options = {}) {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw new TypeError("a 3dGraph tour requires at least two waypoints");
  }
  const normalized = waypoints.map((waypoint, index) => ({
    position: toPoint(waypoint.position, `waypoints[${index}].position`),
    lookAt: toPoint(waypoint.lookAt, `waypoints[${index}].lookAt`),
    durationMs: Math.max(1, Number(waypoint.durationMs || waypoint.duration || 0) || 0),
  }));
  const durationMs = Math.max(
    1,
    Number(options.durationMs || 0)
      || normalized.reduce((sum, waypoint) => sum + waypoint.durationMs, 0)
      || 1000 * (normalized.length - 1),
  );
  return {
    waypoints: normalized,
    durationMs,
    easing: options.easing || "smootherstep",
  };
}

export function sampleTour(tour, progress) {
  const t = tour.easing === "linear" ? Math.max(0, Math.min(1, progress)) : smootherstep(progress);
  const segments = tour.waypoints.length - 1;
  const scaled = Math.min(segments - 1e-9, t * segments);
  const index = Math.floor(scaled);
  const localT = scaled - index;
  const a = tour.waypoints[index];
  const b = tour.waypoints[index + 1];
  return {
    position: lerpPoint(a.position, b.position, localT),
    lookAt: lerpPoint(a.lookAt, b.lookAt, localT),
    progress: t,
  };
}
