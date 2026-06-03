import * as THREE from 'three';

const _plane = new THREE.Plane();
const _hit = new THREE.Vector3();
const _normal = new THREE.Vector3();

/**
 * Ray vs plane through anchor, facing the camera (screen-space drag).
 * @param {THREE.Ray} worldRay
 * @param {THREE.Vector3} anchorWorld
 * @param {THREE.Camera} camera
 * @returns {THREE.Vector3 | null}
 */
export function intersectViewPlane(worldRay, anchorWorld, camera) {
  camera.getWorldDirection(_normal);
  _plane.setFromNormalAndCoplanarPoint(_normal, anchorWorld);
  return worldRay.intersectPlane(_plane, _hit) ? _hit.clone() : null;
}
