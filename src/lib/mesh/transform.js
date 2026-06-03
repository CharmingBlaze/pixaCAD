import * as THREE from 'three';
import { getObjectWorldMatrix } from '../scene/groupTransform.js';

/**
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }} object
 */
export function objectMatrix(object) {
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3(...object.position);
  const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(object.rotation[0], object.rotation[1], object.rotation[2]),
  );
  const scale = new THREE.Vector3(...object.scale);
  m.compose(pos, quat, scale);
  return m;
}

const _inv = new THREE.Matrix4();
const _ray = new THREE.Ray();

/**
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number], parentId?: string | null }} object
 * @param {import('../store/editorStore.js').SceneObject[] | null | undefined} [objects]
 */
function resolveWorldMatrix(object, objects) {
  return objects?.length ? getObjectWorldMatrix(objects, object) : objectMatrix(object);
}

/**
 * World-space screen ray → ray in mesh/object local space (matches EditableMesh positions).
 * @param {THREE.Ray} worldRay
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number], parentId?: string | null }} object
 * @param {import('../store/editorStore.js').SceneObject[] | null | undefined} [objects]
 */
export function worldRayToMeshLocal(worldRay, object, objects) {
  _inv.copy(resolveWorldMatrix(object, objects)).invert();
  _ray.copy(worldRay).applyMatrix4(_inv);
  return _ray;
}

/**
 * @param {[number, number, number]} worldPos
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number], parentId?: string | null }} object
 * @param {import('../store/editorStore.js').SceneObject[] | null | undefined} [objects]
 * @returns {[number, number, number]}
 */
export function worldToLocal(worldPos, object, objects) {
  const v = new THREE.Vector3(...worldPos);
  v.applyMatrix4(_inv.copy(resolveWorldMatrix(object, objects)).invert());
  return [v.x, v.y, v.z];
}

/**
 * @param {[number, number, number]} localPos
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number], parentId?: string | null }} object
 * @param {import('../store/editorStore.js').SceneObject[] | null | undefined} [objects]
 * @returns {[number, number, number]}
 */
export function localToWorld(localPos, object, objects) {
  const v = new THREE.Vector3(...localPos);
  v.applyMatrix4(resolveWorldMatrix(object, objects));
  return [v.x, v.y, v.z];
}
