import * as THREE from 'three';
import { DRAW_PLANE_ROTATION } from '../../components/viewport/drawPlaneConfig.js';

const _normal = new THREE.Vector3(0, 0, 1);
const _euler = new THREE.Euler();
const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();

/**
 * @param {import('../../components/viewport/orthoViewSetup.js').OrthoViewId | null} orthoView
 */
function getDrawPlane(orthoView) {
  const key = orthoView ?? 'perspective';
  _euler.set(...DRAW_PLANE_ROTATION[key]);
  _normal.set(0, 0, 1).applyEuler(_euler);
  _plane.setFromNormalAndCoplanarPoint(_normal, new THREE.Vector3(0, 0, 0));
  return _plane;
}

/**
 * @param {THREE.Raycaster} raycaster
 * @param {THREE.Camera} camera
 * @param {number} clientX
 * @param {number} clientY
 * @param {HTMLElement} domElement
 * @param {import('../../components/viewport/orthoViewSetup.js').OrthoViewId | null} orthoView
 * @returns {[number, number, number] | null}
 */
export function raycastDrawPoint(raycaster, camera, clientX, clientY, domElement, orthoView) {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);

  const plane = getDrawPlane(orthoView);
  return raycaster.ray.intersectPlane(plane, _hit) ? [_hit.x, _hit.y, _hit.z] : null;
}
