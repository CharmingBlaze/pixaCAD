import * as THREE from 'three';
import { getObjectWorldMatrix } from '../scene/groupTransform.js';

const _wm = new THREE.Matrix4();
const _min = new THREE.Vector3();
const _max = new THREE.Vector3();
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _anchor = new THREE.Vector3();
const _tip = new THREE.Vector3();
const _ndcA = new THREE.Vector3();
const _ndcB = new THREE.Vector3();

/**
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {number[]} faceIndices
 */
export function computeExtrudeWorldExtent(object, objects, faceIndices) {
  const mesh = object.mesh;
  if (!mesh) return 1;

  _wm.copy(getObjectWorldMatrix(objects, object));
  _min.set(Infinity, Infinity, Infinity);
  _max.set(-Infinity, -Infinity, -Infinity);

  const verts = new Set();
  for (const fi of faceIndices) {
    const face = mesh.faces[fi];
    if (!face) continue;
    for (const vi of face) verts.add(vi);
  }

  if (verts.size === 0) return 1;

  for (const vi of verts) {
    _p.fromArray(mesh.getPosition(vi)).applyMatrix4(_wm);
    _min.min(_p);
    _max.max(_p);
  }

  const size = _max.clone().sub(_min);
  return Math.max(size.x, size.y, size.z, 0.25);
}

/**
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {number[]} faceIndices
 * @returns {THREE.Vector3}
 */
export function computeRegionWorldNormal(object, objects, faceIndices) {
  const mesh = object.mesh;
  if (!mesh) return new THREE.Vector3(0, 1, 0);

  _wm.copy(getObjectWorldMatrix(objects, object));
  _n.set(0, 0, 0);

  for (const fi of faceIndices) {
    const local = mesh.getFaceNormal(fi);
    _n.x += local.x;
    _n.y += local.y;
    _n.z += local.z;
  }

  if (_n.lengthSq() < 1e-10) return new THREE.Vector3(0, 1, 0);
  return _n.transformDirection(_wm).normalize();
}

/**
 * World anchor at selection centroid (for stable screen projection).
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {number[]} faceIndices
 * @returns {THREE.Vector3}
 */
export function computeExtrudeWorldAnchor(object, objects, faceIndices) {
  const mesh = object.mesh;
  if (!mesh) return new THREE.Vector3();

  _wm.copy(getObjectWorldMatrix(objects, object));
  _anchor.set(0, 0, 0);
  let count = 0;

  for (const fi of faceIndices) {
    const face = mesh.faces[fi];
    if (!face) continue;
    for (const vi of face) {
      _p.fromArray(mesh.getPosition(vi)).applyMatrix4(_wm);
      _anchor.add(_p);
      count += 1;
    }
  }

  if (count > 0) _anchor.multiplyScalar(1 / count);
  return _anchor.clone();
}

/**
 * Unit screen-space direction (client pixels) for dragging along a world normal.
 * @param {THREE.Vector3} worldNormal
 * @param {THREE.Vector3} worldAnchor
 * @param {THREE.Camera} camera
 * @param {{ width: number, height: number }} viewportSize
 */
export function worldNormalScreenDirection(worldNormal, worldAnchor, camera, viewportSize) {
  _ndcA.copy(worldAnchor).project(camera);
  _tip.copy(worldAnchor).add(worldNormal);
  _ndcB.copy(_tip).project(camera);

  const w = Math.max(viewportSize.width, 1);
  const h = Math.max(viewportSize.height, 1);
  const sx = (_ndcB.x - _ndcA.x) * w * 0.5;
  const sy = -(_ndcB.y - _ndcA.y) * h * 0.5;
  const len = Math.hypot(sx, sy);

  if (len < 2) {
    return { x: 0, y: -1, magnitude: 0 };
  }

  return { x: sx / len, y: sy / len, magnitude: len };
}

/**
 * Blender-style modal extrude distance from pointer (projected along normal in screen space).
 * @param {{
 *   startClientX: number,
 *   startClientY: number,
 *   clientX: number,
 *   clientY: number,
 *   startDistance: number,
 *   screenDir: { x: number, y: number, magnitude: number },
 *   worldExtent: number,
 *   shiftKey?: boolean,
 * }} params
 */
export function extrudeDistanceFromPointer(params) {
  const {
    startClientX,
    startClientY,
    clientX,
    clientY,
    startDistance,
    screenDir,
    worldExtent,
    shiftKey = false,
  } = params;

  const dx = clientX - startClientX;
  const dy = clientY - startClientY;
  const along =
    screenDir.magnitude < 2
      ? -(clientY - startClientY)
      : dx * screenDir.x + dy * screenDir.y;

  const precision = shiftKey ? 0.1 : 1;
  const sensitivity = worldExtent * 0.0015 * precision;
  return startDistance + along * sensitivity;
}

/**
 * Scroll wheel step sized to the selection (Blender-style discrete nudge).
 * @param {number} worldExtent
 * @param {boolean} [shiftKey]
 */
export function extrudeWheelStep(worldExtent, shiftKey = false) {
  const precision = shiftKey ? 0.1 : 1;
  return worldExtent * 0.04 * precision;
}

/**
 * @param {import('../../store/editorStore.js').EditorState} state
 * @param {THREE.Camera} camera
 * @param {HTMLElement} canvas
 */
export function buildExtrudeDragContext(state, camera, canvas) {
  const obj = state.objects.find((o) => o.id === state.selectedId);
  if (!obj?.mesh) return null;

  const faceIndices = state.extrudeFaceIndices ?? [];
  const worldNormal = computeRegionWorldNormal(obj, state.objects, faceIndices);
  const worldAnchor = computeExtrudeWorldAnchor(obj, state.objects, faceIndices);
  const worldExtent = computeExtrudeWorldExtent(obj, state.objects, faceIndices);
  const rect = canvas.getBoundingClientRect();

  const screenDir = worldNormalScreenDirection(worldNormal, worldAnchor, camera, {
    width: rect.width,
    height: rect.height,
  });

  return {
    worldNormal,
    worldAnchor,
    worldExtent,
    screenDir,
    startDistance: state.extrudeDistance ?? 0,
  };
}
