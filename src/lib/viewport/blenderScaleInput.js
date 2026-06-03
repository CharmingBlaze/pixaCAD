import * as THREE from 'three';
import { getObjectWorldMatrix } from '../scene/groupTransform.js';
import { worldNormalScreenDirection } from './blenderExtrudeInput.js';

const _wm = new THREE.Matrix4();
const _min = new THREE.Vector3();
const _max = new THREE.Vector3();
const _p = new THREE.Vector3();

/** Min reference distance (px) when the cursor starts on the pivot. */
export const MIN_SCALE_SCREEN_REF_PX = 12;

/**
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {number[]} vertexIndices
 */
export function computeVertexSelectionWorldExtent(object, objects, vertexIndices) {
  const mesh = object.mesh;
  if (!mesh || vertexIndices.length === 0) return 1;

  _wm.copy(getObjectWorldMatrix(objects, object));
  _min.set(Infinity, Infinity, Infinity);
  _max.set(-Infinity, -Infinity, -Infinity);

  for (const vi of vertexIndices) {
    _p.fromArray(mesh.getPosition(vi)).applyMatrix4(_wm);
    _min.min(_p);
    _max.max(_p);
  }

  const size = _max.clone().sub(_min);
  return Math.max(size.x, size.y, size.z, 0.25);
}

/**
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {string[]} objectIds
 */
export function computeObjectsWorldExtent(objects, objectIds) {
  _min.set(Infinity, Infinity, Infinity);
  _max.set(-Infinity, -Infinity, -Infinity);
  let any = false;

  for (const id of objectIds) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) continue;
    _wm.copy(getObjectWorldMatrix(objects, obj));
    _p.set(0, 0, 0).applyMatrix4(_wm);
    _min.min(_p);
    _max.max(_p);
    any = true;
    if (obj.mesh) {
      const count = obj.mesh.vertexCount ?? Math.floor(obj.mesh.positions.length / 3);
      for (let vi = 0; vi < count; vi += 1) {
        _p.fromArray(obj.mesh.getPosition(vi)).applyMatrix4(_wm);
        _min.min(_p);
        _max.max(_p);
      }
    }
  }

  if (!any) return 1;
  const size = _max.clone().sub(_min);
  return Math.max(size.x, size.y, size.z, 0.25);
}

/**
 * @param {'X' | 'Y' | 'Z'} lock
 * @returns {[number, number, number]}
 */
export function worldAxisFromLock(lock) {
  if (lock === 'X') return [1, 0, 0];
  if (lock === 'Y') return [0, 1, 0];
  return [0, 0, 1];
}

/**
 * @param {[number, number, number]} axisWorld
 * @param {THREE.Vector3} worldAnchor
 * @param {THREE.Camera} camera
 * @param {{ width: number, height: number }} viewportSize
 */
export function worldAxisScreenDirection(axisWorld, worldAnchor, camera, viewportSize) {
  const axis = new THREE.Vector3(axisWorld[0], axisWorld[1], axisWorld[2]);
  return worldNormalScreenDirection(axis, worldAnchor, camera, viewportSize);
}

/**
 * Blender modal scale: ratio along pivot→start screen line (or axis screen line when locked).
 * @param {{
 *   pivotX: number,
 *   pivotY: number,
 *   startX: number,
 *   startY: number,
 *   clientX: number,
 *   clientY: number,
 *   screenDir?: { x: number, y: number, magnitude: number } | null,
 *   shiftKey?: boolean,
 *   wheelMultiplier?: number,
 * }} params
 */
export function scaleFactorFromPointer(params) {
  const {
    pivotX,
    pivotY,
    startX,
    startY,
    clientX,
    clientY,
    screenDir = null,
    shiftKey = false,
    wheelMultiplier = 1,
  } = params;

  const precision = shiftKey ? 0.1 : 1;
  const startDx = startX - pivotX;
  const startDy = startY - pivotY;
  const curDx = clientX - pivotX;
  const curDy = clientY - pivotY;

  let rawRatio;

  if (screenDir && screenDir.magnitude >= 2) {
    const startAlong = startDx * screenDir.x + startDy * screenDir.y;
    const curAlong = curDx * screenDir.x + curDy * screenDir.y;
    const ref =
      Math.abs(startAlong) < 2
        ? (curAlong >= startAlong ? MIN_SCALE_SCREEN_REF_PX : -MIN_SCALE_SCREEN_REF_PX)
        : startAlong;
    rawRatio = curAlong / ref;
  } else {
    const startLen = Math.hypot(startDx, startDy);
    if (startLen < 2) {
      const ref = MIN_SCALE_SCREEN_REF_PX;
      rawRatio = Math.hypot(curDx, curDy) / ref;
    } else {
      const inv = 1 / startLen;
      const dirX = startDx * inv;
      const dirY = startDy * inv;
      const startAlong = startLen;
      const curAlong = curDx * dirX + curDy * dirY;
      rawRatio = curAlong / startAlong;
    }
  }

  const delta = (rawRatio - 1) * precision;
  return Math.max(0.001, (1 + delta) * wheelMultiplier);
}

/**
 * Multiplicative wheel nudge during modal scale.
 * @param {number} worldExtent
 * @param {boolean} [shiftKey]
 */
export function scaleWheelMultiplierStep(worldExtent, shiftKey = false) {
  const precision = shiftKey ? 0.1 : 1;
  return 1 + worldExtent * 0.02 * precision;
}

/**
 * @param {'X' | 'Y' | 'Z' | null} axisLock
 * @param {number} uniformFactor
 * @returns {[number, number, number] | null}
 */
export function scaleFactorsFromAxisLock(axisLock, uniformFactor) {
  if (!axisLock) return null;
  const f = uniformFactor;
  if (axisLock === 'X') return [f, 1, 1];
  if (axisLock === 'Y') return [1, f, 1];
  return [1, 1, f];
}
