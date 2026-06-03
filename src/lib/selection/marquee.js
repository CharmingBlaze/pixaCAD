import * as THREE from 'three';

const _v = new THREE.Vector3();

/**
 * @param {[number, number, number] | THREE.Vector3} worldPos
 * @param {THREE.Camera} camera
 * @param {DOMRect} domRect
 */
export function worldToClientPoint(worldPos, camera, domRect) {
  if (worldPos instanceof THREE.Vector3) {
    _v.copy(worldPos);
  } else {
    _v.set(worldPos[0], worldPos[1], worldPos[2]);
  }
  _v.project(camera);
  return {
    x: domRect.left + ((_v.x + 1) / 2) * domRect.width,
    y: domRect.top + ((-_v.y + 1) / 2) * domRect.height,
  };
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 */
export function normalizeMarqueeRect(x0, y0, x1, y1) {
  const crossing = x1 < x0;
  return {
    left: Math.min(x0, x1),
    top: Math.min(y0, y1),
    right: Math.max(x0, x1),
    bottom: Math.max(y0, y1),
    crossing,
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

/**
 * @param {number} px
 * @param {number} py
 * @param {{ left: number, top: number, right: number, bottom: number }} rect
 */
export function pointInMarquee(px, py, rect) {
  return px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom;
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 */
function orient(ax, ay, bx, by, cx, cy) {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * @param {number} ax
 * @param {number} ay
 * @param {number} bx
 * @param {number} by
 * @param {number} cx
 * @param {number} cy
 * @param {number} dx
 * @param {number} dy
 */
function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
    return (
      Math.max(ax, bx) >= Math.min(cx, dx) &&
      Math.max(cx, dx) >= Math.min(ax, bx) &&
      Math.max(ay, by) >= Math.min(cy, dy) &&
      Math.max(cy, dy) >= Math.min(ay, by)
    );
  }
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/**
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @param {{ left: number, top: number, right: number, bottom: number }} rect
 */
export function segmentIntersectsMarquee(x1, y1, x2, y2, rect) {
  if (pointInMarquee(x1, y1, rect) || pointInMarquee(x2, y2, rect)) return true;
  const { left, top, right, bottom } = rect;
  return (
    segmentsIntersect(x1, y1, x2, y2, left, top, right, top) ||
    segmentsIntersect(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsIntersect(x1, y1, x2, y2, left, bottom, left, top)
  );
}

/**
 * Screen-space bounds for a set of client points.
 * @param {{ x: number, y: number }[]} points
 */
export function boundsFromClientPoints(points) {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const p of points) {
    left = Math.min(left, p.x);
    top = Math.min(top, p.y);
    right = Math.max(right, p.x);
    bottom = Math.max(bottom, p.y);
  }
  return { left, top, right, bottom };
}

/**
 * @param {{ left: number, top: number, right: number, bottom: number }} inner
 * @param {{ left: number, top: number, right: number, bottom: number }} outer
 * @param {boolean} crossing
 */
export function boundsMatchesMarquee(inner, outer, crossing) {
  if (crossing) {
    return !(
      inner.right < outer.left ||
      inner.left > outer.right ||
      inner.bottom < outer.top ||
      inner.top > outer.bottom
    );
  }
  return (
    inner.left >= outer.left &&
    inner.right <= outer.right &&
    inner.top >= outer.top &&
    inner.bottom <= outer.bottom
  );
}
