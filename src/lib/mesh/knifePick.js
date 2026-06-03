import * as THREE from 'three';
import { screenDistancePx, screenSegmentDistancePx } from './pick.js';
import { localToWorld } from './transform.js';

const _hit = new THREE.Vector3();
const _bestHit = new THREE.Vector3();
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _xAxis = new THREE.Vector3();
const _yAxis = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _point = new THREE.Vector3();

function cross2(u, v) {
  return u[0] * v[1] - u[1] * v[0];
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number} faceIndex
 */
function faceBasis2D(mesh, faceIndex) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return null;

  _normal.copy(mesh.getFaceNormal(faceIndex));
  if (_normal.lengthSq() < 1e-12) return null;

  const p0 = mesh.getPosition(face[0]);
  const p1 = mesh.getPosition(face[1]);
  _xAxis.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).projectOnPlane(_normal);
  if (_xAxis.lengthSq() < 1e-12) {
    const p2 = mesh.getPosition(face[2]);
    _xAxis.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]).projectOnPlane(_normal);
  }
  if (_xAxis.lengthSq() < 1e-12) return null;
  _xAxis.normalize();
  _yAxis.crossVectors(_normal, _xAxis).normalize();
  _origin.set(p0[0], p0[1], p0[2]);

  const to2 = (local) => {
    _point.set(local[0], local[1], local[2]).sub(_origin);
    return [_point.dot(_xAxis), _point.dot(_yAxis)];
  };

  return { to2, points2: face.map((vi) => to2(mesh.getPosition(vi))) };
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number} faceIndex
 * @param {[number, number, number]} localPoint
 * @param {number} [planeEps]
 */
export function localPointOnFace(mesh, faceIndex, localPoint, planeEps = 1e-4) {
  const basis = faceBasis2D(mesh, faceIndex);
  if (!basis) return false;

  const p2 = basis.to2(localPoint);
  const normal = mesh.getFaceNormal(faceIndex);
  _point.set(localPoint[0], localPoint[1], localPoint[2]);
  const anchor = mesh.getPosition(mesh.faces[faceIndex][0]);
  const planeDist = Math.abs(
    (localPoint[0] - anchor[0]) * normal.x +
      (localPoint[1] - anchor[1]) * normal.y +
      (localPoint[2] - anchor[2]) * normal.z,
  );
  if (planeDist > planeEps) return false;

  let inside = false;
  const poly = basis.points2;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i];
    const pj = poly[j];
    const intersect =
      pi[1] > p2[1] !== pj[1] > p2[1] &&
      p2[0] < ((pj[0] - pi[0]) * (p2[1] - pi[1])) / (pj[1] - pi[1] + 1e-12) + pi[0];
    if (intersect) inside = !inside;
  }

  if (inside) return true;

  const edgeEps = 1e-4;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    const pi = poly[i];
    const pj = poly[j];
    const edge = [pj[0] - pi[0], pj[1] - pi[1]];
    const lenSq = edge[0] * edge[0] + edge[1] * edge[1];
    if (lenSq < 1e-12) continue;
    const ap = [p2[0] - pi[0], p2[1] - pi[1]];
    let t = (ap[0] * edge[0] + ap[1] * edge[1]) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const dist = Math.hypot(ap[0] - edge[0] * t, ap[1] - edge[1] * t);
    if (dist <= edgeEps) return true;
  }

  return false;
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {THREE.Ray} ray
 * @param {number} faceIndex
 */
export function rayHitFace(mesh, ray, faceIndex) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return null;

  let bestDist = Infinity;
  let found = null;

  for (let i = 1; i < face.length - 1; i++) {
    _v0.fromArray(mesh.positions, face[0] * 3);
    _v1.fromArray(mesh.positions, face[i] * 3);
    _v2.fromArray(mesh.positions, face[i + 1] * 3);
    const point = ray.intersectTriangle(_v0, _v1, _v2, false, _hit);
    if (!point) continue;
    const dist = ray.origin.distanceToSquared(point);
    if (dist < bestDist) {
      bestDist = dist;
      found = [_bestHit.copy(point).x, _bestHit.y, _bestHit.z];
    }
  }

  return found;
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {THREE.Ray} ray
 * @param {{ preferFaceIndex?: number | null }} [options]
 */
export function hitFacePoint(mesh, ray, options = {}) {
  const { preferFaceIndex = null } = options;

  if (preferFaceIndex !== null && preferFaceIndex >= 0) {
    const preferred = rayHitFace(mesh, ray, preferFaceIndex);
    if (preferred) {
      return { faceIndex: preferFaceIndex, localPoint: preferred };
    }
  }

  let bestFace = -1;
  let bestDist = Infinity;

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const localPoint = rayHitFace(mesh, ray, fi);
    if (!localPoint) continue;
    _bestHit.set(localPoint[0], localPoint[1], localPoint[2]);
    const dist = ray.origin.distanceToSquared(_bestHit);
    if (dist < bestDist) {
      bestDist = dist;
      bestFace = fi;
    }
  }

  if (bestFace < 0) return null;

  let localPoint = rayHitFace(mesh, ray, bestFace);
  if (!localPoint) return null;

  if (
    preferFaceIndex !== null &&
    preferFaceIndex >= 0 &&
    bestFace !== preferFaceIndex &&
    localPointOnFace(mesh, preferFaceIndex, localPoint)
  ) {
    return { faceIndex: preferFaceIndex, localPoint };
  }

  return { faceIndex: bestFace, localPoint };
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number} faceIndex
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../store/editorStore.js').SceneObject[] | undefined} objects
 * @param {THREE.Camera} camera
 * @param {THREE.Vector2} pointerNdc
 * @param {{ width: number, height: number }} viewportSize
 * @param {number} thresholdPx
 */
export function snapKnifePointOnFace(
  mesh,
  faceIndex,
  object,
  objects,
  camera,
  pointerNdc,
  viewportSize,
  thresholdPx = 20,
) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return null;

  let bestLocalPoint = null;
  let bestVertexIndex = null;
  let bestDist = thresholdPx;

  const toWorld = (local) => {
    const w = localToWorld(local, object, objects);
    return _point.set(w[0], w[1], w[2]);
  };

  for (const vi of face) {
    const local = mesh.getPosition(vi);
    const d = screenDistancePx(toWorld(local), camera, pointerNdc, viewportSize);
    if (d < bestDist) {
      bestDist = d;
      bestLocalPoint = local;
      bestVertexIndex = vi;
    }
  }

  for (let i = 0; i < face.length; i++) {
    const a = mesh.getPosition(face[i]);
    const b = mesh.getPosition(face[(i + 1) % face.length]);
    const d = screenSegmentDistancePx(toWorld(a), toWorld(b), camera, pointerNdc, viewportSize);
    if (d >= bestDist) continue;

    const pa = toWorld(a).clone().project(camera);
    const pb = toWorld(b).clone().project(camera);
    const ax = (pa.x - pointerNdc.x) * 0.5 * viewportSize.width;
    const ay = (pa.y - pointerNdc.y) * 0.5 * viewportSize.height;
    const bx = (pb.x - pointerNdc.x) * 0.5 * viewportSize.width;
    const by = (pb.y - pointerNdc.y) * 0.5 * viewportSize.height;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq < 1e-10 ? 0 : Math.max(0, Math.min(1, (-ax * dx - ay * dy) / lenSq));

    bestDist = d;
    bestLocalPoint = [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    bestVertexIndex = t <= 0.02 ? face[i] : t >= 0.98 ? face[(i + 1) % face.length] : null;
  }

  return bestLocalPoint
    ? { localPoint: bestLocalPoint, vertexIndex: bestVertexIndex }
    : null;
}

/**
 * Resolve which face a knife endpoint belongs to during an in-progress cut.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number | null | undefined} activeFaceIndex
 * @param {number} pickedFaceIndex
 * @param {[number, number, number]} localPoint
 */
export function resolveKnifeFaceIndex(mesh, activeFaceIndex, pickedFaceIndex, localPoint) {
  if (activeFaceIndex == null || activeFaceIndex < 0) return pickedFaceIndex;
  if (pickedFaceIndex === activeFaceIndex) return activeFaceIndex;
  if (localPointOnFace(mesh, activeFaceIndex, localPoint)) return activeFaceIndex;
  return pickedFaceIndex;
}
