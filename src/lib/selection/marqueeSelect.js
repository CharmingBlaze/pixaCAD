import * as THREE from 'three';
import { localToWorld, worldRayToMeshLocal } from '../mesh/transform.js';
import { getObjectWorldMatrix } from '../scene/groupTransform.js';
import { pickVertex, pickEdge, pickFace } from '../mesh/pick.js';
import {
  boundsFromClientPoints,
  boundsMatchesMarquee,
  pointInMarquee,
  segmentIntersectsMarquee,
  worldToClientPoint,
} from './marquee.js';

/** @typedef {{ camera: THREE.Camera, clientX: number, clientY: number, domRect: DOMRect, paddingPx?: number }} ObjectPickScreenOptions */

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _center = new THREE.Vector3();

/**
 * @param {import('../../store/editorStore.js').EditorState} state
 * @param {number} clientX
 * @param {number} clientY
 * @param {THREE.Camera} camera
 * @param {HTMLCanvasElement} canvas
 * @param {{ width: number, height: number }} viewportSize
 */
export function hasDirectSelectionHit(state, clientX, clientY, camera, canvas, viewportSize) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;

  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);

  if (state.editMode === 'object') {
    return pickObjectAt(state.objects, _raycaster.ray) !== null;
  }

  const obj = state.objects.find((o) => o.id === state.selectedId);
  if (!obj?.mesh) return false;

  const localRay = worldRayToMeshLocal(_raycaster.ray, obj, state.objects);
  const pickOpts = {
    camera,
    pointerNdc: _ndc,
    viewportSize,
    thresholdPx: 14,
    object: obj,
  };
  const maxScale = Math.max(obj.scale[0], obj.scale[1], obj.scale[2], 0.001);

  if (state.editMode === 'vertex') {
    let vi = pickVertex(obj.mesh, localRay, { ...pickOpts, thresholdPx: 20 });
    if (vi < 0) vi = pickVertex(obj.mesh, localRay, 0.15 / maxScale);
    return vi >= 0;
  }

  if (state.editMode === 'edge') {
    return !!pickEdge(obj.mesh, localRay, { ...pickOpts, maxDist: 0.1 / maxScale, thresholdPx: 14 });
  }

  if (state.editMode === 'face') {
    return pickFace(obj.mesh, localRay) >= 0;
  }

  return false;
}

/**
 * @param {import('../../store/editorStore.js').EditorState} state
 * @param {number} clientX
 * @param {number} clientY
 * @param {THREE.Camera} camera
 * @param {HTMLCanvasElement} canvas
 */
export function pickObjectIdAtClient(state, clientX, clientY, camera, canvas) {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  _raycaster.setFromCamera(_ndc, camera);
  return pickObjectAt(state.objects, _raycaster.ray, {
    camera,
    clientX,
    clientY,
    domRect: rect,
  });
}

/**
 * Screen-space bounds pick (reliable in ortho when rays graze thin silhouettes).
 * @param {import('../store/editorStore.js').SceneObject} obj
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {ObjectPickScreenOptions} screen
 */
function pickObjectByScreenBounds(obj, objects, screen) {
  if (!obj.mesh || obj.mesh.vertexCount === 0) return false;
  const pad = screen.paddingPx ?? 6;
  const clientPts = [];
  for (let i = 0; i < obj.mesh.vertexCount; i++) {
    clientPts.push(
      worldToClientPoint(localToWorld(obj.mesh.getPosition(i), obj, objects), screen.camera, screen.domRect),
    );
  }
  const bounds = boundsFromClientPoints(clientPts);
  return pointInMarquee(screen.clientX, screen.clientY, {
    left: bounds.left - pad,
    top: bounds.top - pad,
    right: bounds.right + pad,
    bottom: bounds.bottom + pad,
  });
}

/**
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {THREE.Ray} ray
 * @param {ObjectPickScreenOptions | null} [screen]
 */
export function pickObjectAt(objects, ray, screen = null) {
  let bestId = null;
  let bestT = Infinity;

  for (const obj of objects) {
    if (!obj.visible || !obj.mesh || obj.isGroup) continue;
    const localRay = worldRayToMeshLocal(ray, obj, objects);
    const fi = pickFace(obj.mesh, localRay);
    const hitFace = fi >= 0;
    const hitScreen = !hitFace && screen ? pickObjectByScreenBounds(obj, objects, screen) : false;
    if (!hitFace && !hitScreen) continue;
    getObjectWorldMatrix(objects, obj).decompose(_center, new THREE.Quaternion(), new THREE.Vector3());
    const t = ray.origin.distanceToSquared(_center);
    if (t < bestT) {
      bestT = t;
      bestId = obj.id;
    }
  }

  return bestId;
}

/**
 * @param {{
 *   editMode: import('../../store/editorStore.js').EditMode,
 *   objects: import('../store/editorStore.js').SceneObject[],
 *   selectedId: string | null,
 *   object: import('../store/editorStore.js').SceneObject | null,
 *   mesh: import('../mesh/EditableMesh.js').EditableMesh | null,
 *   camera: THREE.Camera,
 *   domRect: DOMRect,
 *   marqueeRect: ReturnType<import('./marquee.js').normalizeMarqueeRect>,
 * }} ctx
 */
export function collectMarqueeSelection(ctx) {
  const { editMode, objects, object, mesh, camera, domRect, marqueeRect } = ctx;
  const crossing = marqueeRect.crossing;

  if (editMode === 'object') {
    const objectIds = collectObjectsInMarquee(objects, camera, domRect, marqueeRect);
    return { targetId: null, objectIds, vertices: [], edges: [], faces: [] };
  }

  const source = object?.mesh
    ? { object, mesh }
    : pickBestMeshInMarquee(objects, editMode, camera, domRect, marqueeRect, crossing);

  if (!source) {
    return { targetId: null, objectIds: [], vertices: [], edges: [], faces: [] };
  }

  const { object: hitObject, mesh: hitMesh } = source;

  if (editMode === 'vertex') {
    return {
      targetId: hitObject.id,
      objectIds: [],
      vertices: collectVerticesInMarquee(hitObject, hitMesh, objects, camera, domRect, marqueeRect),
      edges: [],
      faces: [],
    };
  }

  if (editMode === 'edge') {
    return {
      targetId: hitObject.id,
      objectIds: [],
      vertices: [],
      edges: collectEdgesInMarquee(hitObject, hitMesh, objects, camera, domRect, marqueeRect, crossing),
      faces: [],
    };
  }

  if (editMode === 'face') {
    return {
      targetId: hitObject.id,
      objectIds: [],
      vertices: [],
      edges: [],
      faces: collectFacesInMarquee(hitObject, hitMesh, objects, camera, domRect, marqueeRect, crossing),
    };
  }

  return { targetId: null, objectIds: [], vertices: [], edges: [], faces: [] };
}

/**
 * When no mesh is active, pick the visible object with the most sub-elements in the box.
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 */
function pickBestMeshInMarquee(objects, editMode, camera, domRect, marqueeRect, crossing) {
  let best = null;
  let bestCount = 0;

  for (const obj of objects) {
    if (!obj.mesh || obj.isGroup || !obj.visible) continue;

    let count = 0;
    if (editMode === 'vertex') {
      count = collectVerticesInMarquee(obj, obj.mesh, objects, camera, domRect, marqueeRect).length;
    } else if (editMode === 'edge') {
      count = collectEdgesInMarquee(obj, obj.mesh, objects, camera, domRect, marqueeRect, crossing).length;
    } else if (editMode === 'face') {
      count = collectFacesInMarquee(obj, obj.mesh, objects, camera, domRect, marqueeRect, crossing).length;
    }

    if (count > bestCount) {
      bestCount = count;
      best = { object: obj, mesh: obj.mesh };
    }
  }

  return best;
}

/**
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../mesh/EditableMesh.js').EditableMesh} mesh
 */
function collectVerticesInMarquee(object, mesh, objects, camera, domRect, marqueeRect) {
  const indices = [];
  for (let i = 0; i < mesh.vertexCount; i++) {
    const { x, y } = worldToClientPoint(localToWorld(mesh.getPosition(i), object, objects), camera, domRect);
    if (pointInMarquee(x, y, marqueeRect)) indices.push(i);
  }
  return indices;
}

/**
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../mesh/EditableMesh.js').EditableMesh} mesh
 */
function collectEdgesInMarquee(object, mesh, objects, camera, domRect, marqueeRect, crossing) {
  const keys = [];
  for (const [va, vb] of mesh.getEdges()) {
    const a = worldToClientPoint(localToWorld(mesh.getPosition(va), object, objects), camera, domRect);
    const b = worldToClientPoint(localToWorld(mesh.getPosition(vb), object, objects), camera, domRect);
    const match = crossing
      ? segmentIntersectsMarquee(a.x, a.y, b.x, b.y, marqueeRect)
      : pointInMarquee(a.x, a.y, marqueeRect) && pointInMarquee(b.x, b.y, marqueeRect);
    if (match) keys.push(va < vb ? `${va}_${vb}` : `${vb}_${va}`);
  }
  return keys;
}

/**
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../mesh/EditableMesh.js').EditableMesh} mesh
 */
function collectFacesInMarquee(object, mesh, objects, camera, domRect, marqueeRect, crossing) {
  const faces = [];
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const pts = face.map((vi) =>
      worldToClientPoint(localToWorld(mesh.getPosition(vi), object, objects), camera, domRect),
    );
    if (crossing) {
      const anyInside = pts.some((p) => pointInMarquee(p.x, p.y, marqueeRect));
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      if (anyInside || pointInMarquee(cx, cy, marqueeRect)) faces.push(fi);
    } else if (pts.every((p) => pointInMarquee(p.x, p.y, marqueeRect))) {
      faces.push(fi);
    }
  }
  return faces;
}

/**
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 */
function collectObjectsInMarquee(objects, camera, domRect, marqueeRect) {
  const crossing = marqueeRect.crossing;
  const hits = [];
  for (const obj of objects) {
    if (!obj.visible || obj.isGroup) continue;
    const clientPts = [];
    if (obj.mesh && obj.mesh.vertexCount > 0) {
      for (let i = 0; i < obj.mesh.vertexCount; i++) {
        clientPts.push(worldToClientPoint(localToWorld(obj.mesh.getPosition(i), obj, objects), camera, domRect));
      }
    } else {
      const wp = new THREE.Vector3();
      getObjectWorldMatrix(objects, obj).decompose(wp, new THREE.Quaternion(), new THREE.Vector3());
      clientPts.push(worldToClientPoint([wp.x, wp.y, wp.z], camera, domRect));
    }
    const bounds = boundsFromClientPoints(clientPts);
    if (boundsMatchesMarquee(bounds, marqueeRect, crossing)) hits.push(obj.id);
  }
  return hits;
}

/**
 * When several objects fall inside the marquee, prefer the one whose screen bounds
 * overlap the marquee the most (stable tie-break: later in scene list).
 * @param {string[]} objectIds
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {THREE.Camera} camera
 * @param {DOMRect} domRect
 * @param {{ left: number, top: number, right: number, bottom: number }} marqueeRect
 */
export function pickPrimaryObjectFromMarquee(objectIds, objects, camera, domRect, marqueeRect) {
  if (objectIds.length === 0) return null;
  if (objectIds.length === 1) return objectIds[0];

  const marqueeArea =
    Math.max(1, marqueeRect.right - marqueeRect.left) * Math.max(1, marqueeRect.bottom - marqueeRect.top);
  let bestId = objectIds[0];
  let bestScore = -1;

  for (const id of objectIds) {
    const obj = objects.find((o) => o.id === id);
    if (!obj) continue;
    const clientPts = [];
    if (obj.mesh && obj.mesh.vertexCount > 0) {
      for (let i = 0; i < obj.mesh.vertexCount; i++) {
        clientPts.push(worldToClientPoint(localToWorld(obj.mesh.getPosition(i), obj, objects), camera, domRect));
      }
    } else {
      const wp = new THREE.Vector3();
      getObjectWorldMatrix(objects, obj).decompose(wp, new THREE.Quaternion(), new THREE.Vector3());
      clientPts.push(worldToClientPoint([wp.x, wp.y, wp.z], camera, domRect));
    }
    const bounds = boundsFromClientPoints(clientPts);
    const overlapW = Math.max(0, Math.min(bounds.right, marqueeRect.right) - Math.max(bounds.left, marqueeRect.left));
    const overlapH = Math.max(0, Math.min(bounds.bottom, marqueeRect.bottom) - Math.max(bounds.top, marqueeRect.top));
    const score = (overlapW * overlapH) / marqueeArea;
    if (score >= bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}
