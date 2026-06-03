/** @typedef {'top' | 'bottom' | 'front' | 'back' | 'right' | 'left' | 'perspective'} ViewportId */
/** @typedef {[number, number, number]} Vec3 */

const MIN_SIZE = 0.25;
const DEFAULT_DEPTH = 1;

/**
 * Snap point to grid.
 * @param {Vec3} p
 * @param {number} grid
 */
/** @param {Vec3} p */
export function copyVec3(p) {
  return [p[0], p[1], p[2]];
}

export function snapPoint(p, grid) {
  if (grid <= 0) return copyVec3(p);
  return [
    Math.round(p[0] / grid) * grid,
    Math.round(p[1] / grid) * grid,
    Math.round(p[2] / grid) * grid,
  ];
}

/**
 * @param {Vec3} a
 * @param {Vec3} b
 */
export function cornersToMinMax(a, b) {
  return {
    min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
    max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
  };
}

/**
 * Expand thin axis for ortho views (2D drag → 3D box).
 * @param {Vec3} min
 * @param {Vec3} max
 * @param {ViewportId | null} viewId
 */
export function expandBoxForView(min, max, viewId) {
  const minOut = [...min];
  const maxOut = [...max];
  const size = [maxOut[0] - minOut[0], maxOut[1] - minOut[1], maxOut[2] - minOut[2]];

  const ensureAxis = (axis, depth = DEFAULT_DEPTH) => {
    if (size[axis] >= MIN_SIZE) return;
    const mid = (minOut[axis] + maxOut[axis]) / 2;
    const h = Math.max(depth, MIN_SIZE);
    minOut[axis] = mid - h / 2;
    maxOut[axis] = mid + h / 2;
    size[axis] = h;
  };

  if (viewId === 'top' || viewId === 'bottom') ensureAxis(1);
  else if (viewId === 'front' || viewId === 'back') ensureAxis(2);
  else if (viewId === 'right' || viewId === 'left') ensureAxis(0);
  else if (viewId === 'perspective') ensureAxis(1);

  for (let i = 0; i < 3; i++) {
    if (maxOut[i] - minOut[i] < MIN_SIZE) {
      const mid = (minOut[i] + maxOut[i]) / 2;
      minOut[i] = mid - MIN_SIZE / 2;
      maxOut[i] = mid + MIN_SIZE / 2;
    }
  }

  return { min: minOut, max: maxOut };
}

/**
 * @param {Vec3} min
 * @param {Vec3} max
 */
export function boxMetrics(min, max) {
  const center = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ];
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { center, size, min, max };
}
