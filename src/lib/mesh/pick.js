import * as THREE from 'three';
import { objectMatrix } from './transform.js';

/**
 * Screen-space distance from pointer to projected world point (pixels).
 * @param {THREE.Vector3} worldPoint
 * @param {THREE.Camera} camera
 * @param {THREE.Vector2} pointerNdc
 * @param {{ width: number, height: number }} size
 */
export function screenDistancePx(worldPoint, camera, pointerNdc, size) {
  const projected = worldPoint.clone().project(camera);
  const dx = (projected.x - pointerNdc.x) * 0.5 * size.width;
  const dy = (projected.y - pointerNdc.y) * 0.5 * size.height;
  return Math.hypot(dx, dy);
}

/**
 * Screen-space distance (px) from pointer to a segment between two world points.
 * Uses 2D segment distance in projected space (reliable in ortho + perspective).
 */
export function screenSegmentDistancePx(a, b, camera, pointerNdc, size) {
  const pa = a.clone().project(camera);
  const pb = b.clone().project(camera);
  const ax = (pa.x - pointerNdc.x) * 0.5 * size.width;
  const ay = (pa.y - pointerNdc.y) * 0.5 * size.height;
  const bx = (pb.x - pointerNdc.x) * 0.5 * size.width;
  const by = (pb.y - pointerNdc.y) * 0.5 * size.height;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) return Math.hypot(ax, ay);
  let t = (-ax * dx - ay * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/**
 * @typedef {{
 *   maxDist?: number,
 *   camera?: THREE.Camera,
 *   pointerNdc?: THREE.Vector2,
 *   viewportSize?: { width: number, height: number },
 *   thresholdPx?: number,
 *   object?: { position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] },
 * }} PickOptions
 */

const _worldPoint = new THREE.Vector3();

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {THREE.Ray} ray
 * @param {number | PickOptions} maxDistOrOpts
 */
export function pickVertex(mesh, ray, maxDistOrOpts = 0.15) {
  const opts = typeof maxDistOrOpts === 'number' ? { maxDist: maxDistOrOpts } : maxDistOrOpts;
  const { maxDist = 0.15, camera, pointerNdc, viewportSize, thresholdPx = 14, object } = opts;
  const worldM = object ? objectMatrix(object) : null;

  if (camera && pointerNdc && viewportSize) {
    let best = -1;
    let bestD = thresholdPx;
    for (let i = 0; i < mesh.vertexCount; i++) {
      _worldPoint.fromArray(mesh.positions, i * 3);
      if (worldM) _worldPoint.applyMatrix4(worldM);
      const d = screenDistancePx(_worldPoint, camera, pointerNdc, viewportSize);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  let best = -1;
  let bestD = maxDist;
  const p = new THREE.Vector3();
  for (let i = 0; i < mesh.vertexCount; i++) {
    p.fromArray(mesh.positions, i * 3);
    const d = ray.distanceToPoint(p);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {THREE.Ray} ray
 * @param {number | PickOptions} maxDistOrOpts
 */
export function pickEdge(mesh, ray, maxDistOrOpts = 0.12) {
  const opts = typeof maxDistOrOpts === 'number' ? { maxDist: maxDistOrOpts } : maxDistOrOpts;
  const { maxDist = 0.12, camera, pointerNdc, viewportSize, thresholdPx = 10, object } = opts;
  const worldM = object ? objectMatrix(object) : null;

  const edges = mesh.getEdges();
  let bestKey = null;
  let bestD = camera && pointerNdc && viewportSize ? thresholdPx : maxDist;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const closest = new THREE.Vector3();

  for (const [va, vb] of edges) {
    a.fromArray(mesh.positions, va * 3);
    b.fromArray(mesh.positions, vb * 3);
    if (worldM) {
      a.applyMatrix4(worldM);
      b.applyMatrix4(worldM);
    }

    if (camera && pointerNdc && viewportSize) {
      const d = screenSegmentDistancePx(a, b, camera, pointerNdc, viewportSize);
      if (d < bestD) {
        bestD = d;
        bestKey = va < vb ? `${va}_${vb}` : `${vb}_${va}`;
      }
      continue;
    }

    const d = Math.sqrt(ray.distanceSqToSegment(a, b));
    if (d < bestD) {
      bestD = d;
      bestKey = va < vb ? `${va}_${vb}` : `${vb}_${va}`;
    }
  }
  return bestKey;
}

/** @param {import('./EditableMesh.js').EditableMesh} mesh @param {THREE.Ray} ray */
export function hitMeshSurface(mesh, ray) {
  return pickFace(mesh, ray) >= 0;
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {THREE.Ray} ray
 */
export function pickFace(mesh, ray) {
  let best = -1;
  let bestT = Infinity;
  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const hit = new THREE.Vector3();

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    for (let i = 1; i < face.length - 1; i++) {
      const tri = [face[0], face[i], face[i + 1]];
      v0.fromArray(mesh.positions, tri[0] * 3);
      v1.fromArray(mesh.positions, tri[1] * 3);
      v2.fromArray(mesh.positions, tri[2] * 3);
      const point = ray.intersectTriangle(v0, v1, v2, false, hit);
      if (point !== null) {
        const t = ray.origin.distanceToSquared(point);
        if (t < bestT) {
          bestT = t;
          best = fi;
        }
      }
    }
  }
  return best;
}
