import * as THREE from 'three';
import { localToWorld } from '../mesh/transform.js';
import { ORTHO_VIEW_SETUP } from '../../components/viewport/orthoViewSetup.js';

const _world = new THREE.Vector3();

export function viewDepthDirection(viewId, camera = null) {
  const setup = ORTHO_VIEW_SETUP[viewId];
  if (setup) {
    return new THREE.Vector3(...setup.position).normalize();
  }
  if (camera) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return dir.negate().normalize();
  }
  return new THREE.Vector3(0, 1, 0);
}

export function vertexDepthValue(object, localPoint, viewId, camera = null) {
  const dir = viewDepthDirection(viewId, camera);
  const world = localToWorld(localPoint, object);
  return _world.fromArray(world).dot(dir);
}

export function vertexDepthRange(object, mesh, viewId, camera = null) {
  if (!object || !mesh || mesh.vertexCount === 0) return { min: 0, max: 0, range: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const depth = vertexDepthValue(object, mesh.getPosition(i), viewId, camera);
    min = Math.min(min, depth);
    max = Math.max(max, depth);
  }
  const range = Math.max(0.0001, max - min);
  return { min, max, range };
}

export function vertexDepthT(object, mesh, index, viewId, camera = null) {
  const range = vertexDepthRange(object, mesh, viewId, camera);
  const depth = vertexDepthValue(object, mesh.getPosition(index), viewId, camera);
  return Math.max(0, Math.min(1, (depth - range.min) / range.range));
}

export function vertexDepthBucket(object, mesh, index, viewId, camera = null) {
  const t = vertexDepthT(object, mesh, index, viewId, camera);
  if (t < 0.34) return 'far';
  if (t < 0.67) return 'mid';
  return 'near';
}

export function chooseVertexByViewDepth(candidates, object, mesh, viewId, camera = null) {
  if (candidates.length === 0) return -1;
  if (candidates.length === 1) return candidates[0];

  const ortho = !!ORTHO_VIEW_SETUP[viewId];
  let best = candidates[0];
  let bestDepth = vertexDepthValue(object, mesh.getPosition(best), viewId, camera);

  for (let i = 1; i < candidates.length; i++) {
    const index = candidates[i];
    const depth = vertexDepthValue(object, mesh.getPosition(index), viewId, camera);
    if (depth > bestDepth) {
      best = index;
      bestDepth = depth;
    }
  }

  return best;
}
