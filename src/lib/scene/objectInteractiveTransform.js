import * as THREE from 'three';
import { computeSelectionGeometryPivotWorld, decomposeTransform, getObjectWorldMatrix } from './groupTransform.js';

/** @typedef {import('../../store/editorStore.js').SceneObject} SceneObject */

const _pivot = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _offset = new THREE.Vector3();
const _world = new THREE.Matrix4();
const _parentInv = new THREE.Matrix4();
const _local = new THREE.Matrix4();

/**
 * @param {SceneObject[]} objects
 * @param {string[]} objectIds
 * @returns {string[]}
 */
export function resolveInteractiveObjectIds(objects, objectIds) {
  return objectIds.filter((id) => {
    const o = objects.find((obj) => obj.id === id);
    return o && !o.locked && !o.isGroup;
  });
}

/**
 * @param {SceneObject[]} objects
 * @param {string[]} objectIds
 */
export function captureObjectInteractiveSession(objects, objectIds) {
  const ids = resolveInteractiveObjectIds(objects, objectIds);
  const members = ids.map((id) => objects.find((o) => o.id === id)).filter(Boolean);
  if (members.length === 0) return null;

  const pivotWorld = computeSelectionGeometryPivotWorld(objects, members);
  /** @type {Record<string, { position: [number, number, number], rotation: [number, number, number], scale: [number, number, number], worldMatrix: number[] }>} */
  const entries = {};

  for (const member of members) {
    entries[member.id] = {
      position: [...member.position],
      rotation: [...member.rotation],
      scale: [...member.scale],
      worldMatrix: getObjectWorldMatrix(objects, member).toArray(),
    };
  }

  return { objectIds: ids, pivotWorld, entries };
}

/**
 * @param {SceneObject[]} objects
 * @param {SceneObject} object
 * @param {THREE.Matrix4} worldMatrix
 */
function worldMatrixToLocalPatch(objects, object, worldMatrix) {
  if (!object.parentId) {
    return decomposeTransform(worldMatrix);
  }
  const parent = objects.find((o) => o.id === object.parentId);
  if (!parent) {
    return decomposeTransform(worldMatrix);
  }
  _parentInv.copy(getObjectWorldMatrix(objects, parent)).invert();
  _local.copy(_parentInv).multiply(worldMatrix);
  return decomposeTransform(_local);
}

/**
 * @param {SceneObject[]} objects
 * @param {ReturnType<typeof captureObjectInteractiveSession>} session
 * @param {{
 *   mode: 'translate' | 'scale' | 'rotate',
 *   worldDelta?: [number, number, number],
 *   scaleFactor?: number,
 *   scaleFactors?: [number, number, number],
 *   angleRad?: number,
 *   axisWorld?: [number, number, number],
 *   deltaQuat?: THREE.Quaternion,
 * }} params
 * @returns {SceneObject[]}
 */
export function applyObjectInteractiveTransform(objects, session, params) {
  if (!session) return objects;

  _pivot.set(session.pivotWorld[0], session.pivotWorld[1], session.pivotWorld[2]);

  if (params.mode === 'translate') {
    const [dx, dy, dz] = params.worldDelta ?? [0, 0, 0];
    return objects.map((obj) => {
      const entry = session.entries[obj.id];
      if (!entry) return obj;

      _world.fromArray(entry.worldMatrix);
      _world.decompose(_pos, _quat, _scale);
      _pos.x += dx;
      _pos.y += dy;
      _pos.z += dz;
      _world.compose(_pos, _quat, _scale);
      const patch = worldMatrixToLocalPatch(objects, obj, _world);
      return { ...obj, ...patch };
    });
  }

  if (params.mode === 'rotate') {
    if (params.deltaQuat) {
      _deltaQuat.copy(params.deltaQuat);
    } else if (params.axisWorld) {
      _axis.set(params.axisWorld[0], params.axisWorld[1], params.axisWorld[2]);
      if (_axis.lengthSq() < 1e-12) _axis.set(0, 1, 0);
      _axis.normalize();
      _deltaQuat.setFromAxisAngle(_axis, params.angleRad ?? 0);
    } else {
      return objects;
    }
  }

  const scaleFactors = params.scaleFactors ?? null;
  const scaleFactor = Math.max(0.001, params.scaleFactor ?? 1);

  return objects.map((obj) => {
    const entry = session.entries[obj.id];
    if (!entry) return obj;

    _world.fromArray(entry.worldMatrix);
    _world.decompose(_pos, _quat, _scale);

    if (params.mode === 'scale') {
      if (scaleFactors) {
        _offset.copy(_pos).sub(_pivot);
        _offset.x *= scaleFactors[0];
        _offset.y *= scaleFactors[1];
        _offset.z *= scaleFactors[2];
        _pos.copy(_pivot).add(_offset);
        _scale.x *= scaleFactors[0];
        _scale.y *= scaleFactors[1];
        _scale.z *= scaleFactors[2];
      } else {
        _offset.copy(_pos).sub(_pivot).multiplyScalar(scaleFactor);
        _pos.copy(_pivot).add(_offset);
        _scale.multiplyScalar(scaleFactor);
      }
    } else {
      _offset.copy(_pos).sub(_pivot).applyQuaternion(_deltaQuat);
      _pos.copy(_pivot).add(_offset);
      _quat.multiplyQuaternions(_deltaQuat, _quat);
    }

    _world.compose(_pos, _quat, _scale);
    const patch = worldMatrixToLocalPatch(objects, obj, _world);
    return { ...obj, ...patch };
  });
}
