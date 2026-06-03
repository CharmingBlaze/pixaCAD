import * as THREE from 'three';
import { objectSnapGrid, vertexSnapGrid } from '../snap/gridSnap.js';
import { getObjectWorldMatrix, worldPositionToObjectLocal } from '../scene/groupTransform.js';
import { localToWorld, worldToLocal } from '../mesh/transform.js';

const _right = new THREE.Vector3();
const _up = new THREE.Vector3();
const _worldPos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _localDelta = new THREE.Vector3();

/** @typedef {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} ViewportArrowKey */
/** @typedef {import('../components/viewport/viewportConfig.js').ViewportId} ViewportId */

/** Arrow nudge with Shift held moves this fraction of the normal step. */
export const NUDGE_FINE_DIVISOR = 10;

/**
 * Step size for one arrow-key press.
 * @param {'object' | 'vertex' | 'edge' | 'face'} editMode
 * @param {boolean} snapGrid
 * @param {number} gridSize
 * @param {{ shiftKey?: boolean }} [options]
 */
export function nudgeStepForMode(editMode, snapGrid, gridSize, options = {}) {
  const g = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1;
  let step;
  if (editMode === 'object') {
    step = snapGrid ? objectSnapGrid(snapGrid, gridSize) : g;
  } else if (snapGrid) {
    step = vertexSnapGrid(snapGrid, gridSize);
  } else {
    step = Math.min(0.1, g);
  }
  if (options.shiftKey) return step / NUDGE_FINE_DIVISOR;
  return step;
}

/**
 * World X / Y / Z nudge (perspective viewport).
 * @param {ViewportArrowKey} arrow
 * @param {number} step
 * @param {{ axisLock?: string | null }} [options]
 */
export function worldAxisArrowDelta(arrow, step, options = {}) {
  if (!(step > 0)) return [0, 0, 0];

  const lock = options.axisLock;
  if (lock === 'X' || lock === 'Y' || lock === 'Z') {
    const sign =
      arrow === 'ArrowUp' || arrow === 'ArrowRight'
        ? 1
        : arrow === 'ArrowDown' || arrow === 'ArrowLeft'
          ? -1
          : 0;
    if (lock === 'X') return [sign * step, 0, 0];
    if (lock === 'Y') return [0, sign * step, 0];
    return [0, 0, sign * step];
  }

  switch (arrow) {
    case 'ArrowUp':
      return [0, step, 0];
    case 'ArrowDown':
      return [0, -step, 0];
    case 'ArrowLeft':
      return [-step, 0, 0];
    case 'ArrowRight':
      return [step, 0, 0];
    default:
      return [0, 0, 0];
  }
}

/**
 * Orthographic / screen-relative translation (camera right & up).
 * @param {THREE.Camera} camera
 * @param {ViewportArrowKey} arrow
 * @param {number} step
 */
export function viewportScreenArrowDelta(camera, arrow, step) {
  if (!(step > 0)) return [0, 0, 0];

  camera.updateMatrixWorld(true);
  _right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  _up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  switch (arrow) {
    case 'ArrowUp':
      _localDelta.copy(_up).multiplyScalar(step);
      break;
    case 'ArrowDown':
      _localDelta.copy(_up).multiplyScalar(-step);
      break;
    case 'ArrowLeft':
      _localDelta.copy(_right).multiplyScalar(-step);
      break;
    case 'ArrowRight':
      _localDelta.copy(_right).multiplyScalar(step);
      break;
    default:
      return [0, 0, 0];
  }

  return [_localDelta.x, _localDelta.y, _localDelta.z];
}

/**
 * @param {THREE.Camera} camera
 * @param {ViewportArrowKey} arrow
 * @param {number} step
 * @param {{ viewId: ViewportId, axisLock?: string | null }} options
 */
export function arrowWorldDelta(camera, arrow, step, options) {
  if (options.viewId === 'perspective') {
    return worldAxisArrowDelta(arrow, step, { axisLock: options.axisLock });
  }
  return viewportScreenArrowDelta(camera, arrow, step);
}

/** @deprecated Use viewportScreenArrowDelta or arrowWorldDelta */
export function viewportArrowWorldDelta(camera, arrow, step) {
  return viewportScreenArrowDelta(camera, arrow, step);
}

/**
 * @param {[number, number, number]} worldDelta
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @returns {[number, number, number]}
 */
export function worldDeltaToMeshLocal(worldDelta, objects, object) {
  const worldMat = getObjectWorldMatrix(objects, object);
  worldMat.decompose(_worldPos, _quat, _scale);
  _localDelta.set(worldDelta[0], worldDelta[1], worldDelta[2]).applyQuaternion(_quat.invert());
  if (_scale.x) _localDelta.x /= _scale.x;
  if (_scale.y) _localDelta.y /= _scale.y;
  if (_scale.z) _localDelta.z /= _scale.z;
  return [_localDelta.x, _localDelta.y, _localDelta.z];
}

/**
 * Move mesh vertices by a world-space delta (handles parent transforms).
 * @param {import('../../lib/mesh/EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {[number, number, number]} worldDelta
 */
export function nudgeMeshVerticesWorld(mesh, vertexIndices, object, objects, worldDelta) {
  const next = mesh.clone();
  for (const vi of vertexIndices) {
    const world = localToWorld(next.getPosition(vi), object, objects);
    const moved = [world[0] + worldDelta[0], world[1] + worldDelta[1], world[2] + worldDelta[2]];
    const local = worldToLocal(moved, object, objects);
    next.setPosition(vi, local[0], local[1], local[2]);
  }
  return next;
}

/**
 * @param {import('../../store/editorStore.js').SceneObject} object
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {[number, number, number]} worldDelta
 * @returns {[number, number, number]}
 */
export function nudgedObjectPosition(object, objects, worldDelta) {
  getObjectWorldMatrix(objects, object).decompose(_worldPos, _quat, _scale);
  const nextWorld = [
    _worldPos.x + worldDelta[0],
    _worldPos.y + worldDelta[1],
    _worldPos.z + worldDelta[2],
  ];
  return worldPositionToObjectLocal(nextWorld, objects, object);
}
