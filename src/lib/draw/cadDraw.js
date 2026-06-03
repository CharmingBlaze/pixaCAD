import * as THREE from 'three';

/** @typedef {'top' | 'bottom' | 'front' | 'back' | 'right' | 'left' | 'perspective'} ViewportId */
/** @typedef {[number, number, number]} Vec3 */

const MIN_SIZE = 0.25;
const DEFAULT_HEIGHT = 1;

/** @type {Record<ViewportId, { planeAxes: [number, number], depthAxis: number }>} */
export const VIEW_DRAW_AXES = {
  top: { planeAxes: [0, 2], depthAxis: 1 },
  bottom: { planeAxes: [0, 2], depthAxis: 1 },
  front: { planeAxes: [0, 1], depthAxis: 2 },
  back: { planeAxes: [0, 1], depthAxis: 2 },
  right: { planeAxes: [1, 2], depthAxis: 0 },
  left: { planeAxes: [1, 2], depthAxis: 0 },
  perspective: { planeAxes: [0, 2], depthAxis: 1 },
};

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _plane = new THREE.Plane();
const _normal = new THREE.Vector3();

/**
 * @param {ViewportId} viewId
 * @param {Vec3} anchor
 */
function setDrawPlane(viewId, anchor) {
  const { depthAxis } = VIEW_DRAW_AXES[viewId];
  _normal.set(0, 0, 0);
  _normal.setComponent(depthAxis, 1);
  _plane.setFromNormalAndCoplanarPoint(_normal, new THREE.Vector3(...anchor));
}

/**
 * Raycast screen coords onto the view draw plane.
 * @returns {Vec3 | null}
 */
export function intersectDrawPlane(clientX, clientY, viewId, anchor, camera, domElement) {
  if (!domElement || !anchor) return null;
  const rect = domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  setDrawPlane(viewId, anchor);
  if (!_raycaster.ray.intersectPlane(_plane, _hit)) return null;
  return [_hit.x, _hit.y, _hit.z];
}

/**
 * Project world hit onto the view draw plane (keeps depth axis from anchor).
 */
export function projectToDrawPlane(point, viewId, anchor) {
  const { planeAxes, depthAxis } = VIEW_DRAW_AXES[viewId];
  const out = [...anchor];
  out[planeAxes[0]] = point[planeAxes[0]];
  out[planeAxes[1]] = point[planeAxes[1]];
  out[depthAxis] = anchor[depthAxis];
  return out;
}

/**
 * @param {Vec3} drawStart
 * @param {Vec3} drawCorner2
 * @param {number} drawHeight
 * @param {ViewportId} viewId
 */
export function buildBoxFromDraw(drawStart, drawCorner2, drawHeight, viewId) {
  const { planeAxes, depthAxis } = VIEW_DRAW_AXES[viewId];
  const min = [0, 0, 0];
  const max = [0, 0, 0];

  for (const a of planeAxes) {
    min[a] = Math.min(drawStart[a], drawCorner2[a]);
    max[a] = Math.max(drawStart[a], drawCorner2[a]);
  }

  const anchor = drawStart[depthAxis];
  const h = Math.abs(drawHeight) < MIN_SIZE ? (drawHeight < 0 ? -DEFAULT_HEIGHT : DEFAULT_HEIGHT) : drawHeight;

  if (h >= 0) {
    min[depthAxis] = anchor;
    max[depthAxis] = anchor + h;
  } else {
    min[depthAxis] = anchor + h;
    max[depthAxis] = anchor;
  }

  for (let i = 0; i < 3; i++) {
    if (max[i] - min[i] < MIN_SIZE) {
      const mid = (min[i] + max[i]) / 2;
      min[i] = mid - MIN_SIZE / 2;
      max[i] = mid + MIN_SIZE / 2;
    }
  }

  return { min, max };
}

/** Footprint corners (4 points) on the draw plane for preview lines. */
export function footprintCorners(drawStart, drawCorner2, viewId) {
  const { planeAxes } = VIEW_DRAW_AXES[viewId];
  const a0 = planeAxes[0];
  const a1 = planeAxes[1];
  const depthAxis = VIEW_DRAW_AXES[viewId].depthAxis;
  const d = drawStart[depthAxis];
  const u0 = Math.min(drawStart[a0], drawCorner2[a0]);
  const u1 = Math.max(drawStart[a0], drawCorner2[a0]);
  const v0 = Math.min(drawStart[a1], drawCorner2[a1]);
  const v1 = Math.max(drawStart[a1], drawCorner2[a1]);

  const pt = (u, v) => {
    const p = [0, 0, 0];
    p[a0] = u;
    p[a1] = v;
    p[depthAxis] = d;
    return p;
  };
  return [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)];
}

export function boxMetrics(min, max) {
  return {
    center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2],
    size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    min,
    max,
  };
}

export function formatDrawSize(size) {
  return `${size[0].toFixed(2)} × ${size[1].toFixed(2)} × ${size[2].toFixed(2)}`;
}

export { DEFAULT_HEIGHT, MIN_SIZE };
