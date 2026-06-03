import * as THREE from 'three';
import { getObjectWorldMatrix } from '../scene/groupTransform.js';
import { coalesceSelectedIds } from '../../store/objectSelection.js';
import { VIEWPORT_CONFIG } from '../../components/viewport/viewportConfig.js';
import { ORTHO_CAMERA_DEFAULTS, ORTHO_VIEW_SETUP } from '../../components/viewport/orthoViewSetup.js';

const _point = new THREE.Vector3();
const _center = new THREE.Vector3();
const _size = new THREE.Vector3();
const _dir = new THREE.Vector3();

/** @typedef {import('../../store/editorStore.js').SceneObject} SceneObject */
/** @typedef {import('../../components/viewport/viewportConfig.js').ViewportId} ViewportId */

/**
 * @param {import('../../store/editorStore.js').EditorState} state
 * @param {'selection' | 'scene'} [scope]
 * @returns {string[]}
 */
export function frameTargetObjectIds(state, scope = 'selection') {
  if (scope === 'scene') {
    return state.objects
      .filter((o) => o.visible && !o.isGroup && (o.mesh || !o.parentId))
      .map((o) => o.id);
  }

  const ids = coalesceSelectedIds(state).filter((id) => {
    const obj = state.objects.find((o) => o.id === id);
    return obj && obj.visible && !obj.locked;
  });
  if (ids.length > 0) return ids;
  return state.objects
    .filter((o) => o.visible && !o.isGroup && (o.mesh || !o.parentId))
    .map((o) => o.id);
}

/**
 * @param {SceneObject[]} objects
 * @param {string[]} objectIds
 * @returns {THREE.Box3 | null}
 */
export function computeObjectsWorldBounds(objects, objectIds) {
  const box = new THREE.Box3();
  let hasPoint = false;

  for (const id of objectIds) {
    const object = objects.find((o) => o.id === id);
    if (!object?.visible) continue;

    if (object.mesh?.positions?.length >= 3) {
      const wm = getObjectWorldMatrix(objects, object);
      const positions = object.mesh.positions;
      for (let i = 0; i < positions.length; i += 3) {
        _point.set(positions[i], positions[i + 1], positions[i + 2]).applyMatrix4(wm);
        box.expandByPoint(_point);
        hasPoint = true;
      }
      continue;
    }

    _point.set(0, 0, 0).applyMatrix4(getObjectWorldMatrix(objects, object));
    box.expandByPoint(_point);
    hasPoint = true;
  }

  return hasPoint ? box : null;
}

/**
 * @param {THREE.Vector3} size
 * @param {import('../../components/viewport/orthoViewSetup.js').OrthoViewId} orthoView
 */
function orthoPlaneExtent(size, orthoView) {
  if (orthoView === 'top' || orthoView === 'bottom') return Math.max(size.x, size.z, 0.001);
  if (orthoView === 'front' || orthoView === 'back') return Math.max(size.x, size.y, 0.001);
  return Math.max(size.y, size.z, 0.001);
}

/**
 * @param {THREE.Camera} camera
 * @param {import('three-stdlib').OrbitControls | null} controls
 * @param {THREE.Box3 | null} bounds
 * @param {ViewportId} viewId
 * @param {{ width?: number, height?: number }} [options]
 */
export function frameViewportCamera(camera, controls, bounds, viewId, options = {}) {
  const orthoView = VIEWPORT_CONFIG[viewId]?.orthoView ?? null;
  const target = controls?.target ?? _center.set(0, 0, 0);

  if (!bounds || bounds.isEmpty()) {
    target.set(0, 0, 0);
    if (controls) controls.target.copy(target);
    resetViewportCamera(camera, controls, viewId);
    return;
  }

  bounds.getCenter(_center);
  bounds.getSize(_size);
  target.copy(_center);
  if (controls) controls.target.copy(_center);

  if (camera instanceof THREE.OrthographicCamera && orthoView) {
    const extent = orthoPlaneExtent(_size, orthoView);
    const aspect = (options.width ?? 1) / Math.max(options.height ?? 1, 1);
    const fitExtent = Math.max(extent, extent / aspect) * 1.25;
    camera.zoom = THREE.MathUtils.clamp((ORTHO_CAMERA_DEFAULTS.zoom ?? 48) * 3.2 / fitExtent, 8, 240);
    camera.updateProjectionMatrix();
    if (controls) controls.update();
    return;
  }

  if (camera instanceof THREE.PerspectiveCamera) {
    const maxDim = Math.max(_size.x, _size.y, _size.z, 0.001);
    const fovRad = (camera.fov * Math.PI) / 180;
    const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * 1.35;

    _dir.subVectors(camera.position, target);
    if (_dir.lengthSq() < 1e-8) {
      _dir.set(4, 3.5, 5).sub(target);
    }
    _dir.normalize().multiplyScalar(distance);
    camera.position.copy(_center).add(_dir);
    camera.lookAt(_center);
    if (controls) controls.update();
  }
}

/**
 * @param {THREE.Camera} camera
 * @param {import('three-stdlib').OrbitControls | null} controls
 * @param {ViewportId} viewId
 */
export function resetViewportCamera(camera, controls, viewId) {
  const config = VIEWPORT_CONFIG[viewId];
  const orthoView = config?.orthoView ?? null;

  if (camera instanceof THREE.OrthographicCamera && orthoView) {
    const setup = ORTHO_VIEW_SETUP[orthoView];
    camera.position.set(...setup.position);
    camera.up.set(...setup.up);
    camera.zoom = ORTHO_CAMERA_DEFAULTS.zoom ?? 48;
    camera.near = ORTHO_CAMERA_DEFAULTS.near;
    camera.far = ORTHO_CAMERA_DEFAULTS.far;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, 0, 0);
      controls.update();
    }
    return;
  }

  const defaults = config?.camera ?? VIEWPORT_CONFIG.perspective.camera;
  camera.position.set(...(defaults.position ?? [4, 3.5, 5]));
  if (camera instanceof THREE.PerspectiveCamera && defaults.fov) {
    camera.fov = defaults.fov;
    camera.near = defaults.near ?? 0.1;
    camera.far = defaults.far ?? 500;
    camera.updateProjectionMatrix();
  }
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  if (controls) {
    controls.target.set(0, 0, 0);
    controls.update();
  }
}
