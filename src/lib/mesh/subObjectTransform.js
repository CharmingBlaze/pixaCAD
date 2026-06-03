import * as THREE from 'three';
import { scaleFactorFromPointer } from '../viewport/blenderScaleInput.js';
import { verticesFromEdgeKeys, verticesFromFaceIndices } from './edgeKeys.js';
import { localToWorld, worldToLocal } from './transform.js';

const _viewDir = new THREE.Vector3();
const _localAxis = new THREE.Vector3();
const _objectQuat = new THREE.Quaternion();
const _pivotLocal = new THREE.Vector3();
const _viewAxis = new THREE.Vector3();
const _pivotWorld = new THREE.Vector3();
const _vertexWorld = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();

/** @deprecated Blender scale uses direct ratio; kept for tests referencing legacy gain. */
export const TRANSFORM_MOUSE_GAIN = 1;
/** Slightly lower gain keeps interactive rotate smooth without big angle jumps. */
export const ROTATE_MOUSE_GAIN = 0.32;

/**
 * Vertex indices affected by the current sub-object selection.
 * @param {import('../../store/editorStore.js').EditorState} state
 * @returns {number[]}
 */
export function resolveSubObjectTransformVertices(state) {
  const { selectedId, objects, editMode, selectedVertices, selectedEdges, selectedFaces } = state;
  if (!selectedId) return [];
  const obj = objects.find((o) => o.id === selectedId);
  if (!obj?.mesh) return [];

  if (editMode === 'vertex') return [...selectedVertices];
  if (editMode === 'edge') return verticesFromEdgeKeys(selectedEdges);
  if (editMode === 'face') return verticesFromFaceIndices(obj.mesh, selectedFaces);
  return [];
}

/**
 * Camera view axis in world space (through the screen, into the scene).
 * @param {import('three').Camera} camera
 * @returns {[number, number, number]}
 */
export function viewRotationAxisWorld(camera) {
  camera.updateMatrixWorld(true);
  camera.getWorldDirection(_viewDir);
  if (_viewDir.lengthSq() < 1e-12) return [0, 0, -1];
  _viewDir.normalize();
  return [_viewDir.x, _viewDir.y, _viewDir.z];
}

/**
 * @deprecated Use viewRotationAxisWorld + rotatePositionsInViewSpace
 */
export function viewRotationAxisLocal(camera, object) {
  camera.getWorldDirection(_viewDir);
  _objectQuat.setFromEuler(
    new THREE.Euler(object.rotation[0], object.rotation[1], object.rotation[2], 'XYZ'),
  );
  _localAxis.copy(_viewDir).applyQuaternion(_objectQuat.invert());
  if (_localAxis.lengthSq() < 1e-12) return [0, 1, 0];
  _localAxis.normalize();
  return [_localAxis.x, _localAxis.y, _localAxis.z];
}

/**
 * Project mesh-local pivot to client (window) pixel coordinates.
 * @param {[number, number, number]} centroidLocal
 * @param {{ position: [number, number, number], rotation: [number, number, number], scale: [number, number, number] }} object
 * @param {import('three').Camera} camera
 * @param {HTMLElement} domElement
 */
/**
 * @param {[number, number, number]} pivotWorld
 * @param {import('three').Camera} camera
 * @param {HTMLElement} domElement
 */
export function worldPivotToClientPixels(pivotWorld, camera, domElement) {
  const rect = domElement.getBoundingClientRect();
  _pivotLocal.set(pivotWorld[0], pivotWorld[1], pivotWorld[2]);
  _pivotLocal.project(camera);
  return {
    x: rect.left + (_pivotLocal.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-_pivotLocal.y * 0.5 + 0.5) * rect.height,
  };
}

export function meshPivotToClientPixels(centroidLocal, object, camera, domElement, objects) {
  const world = localToWorld(centroidLocal, object, objects);
  return worldPivotToClientPixels(world, camera, domElement);
}

/**
 * @deprecated Use scaleFactorFromPointer from blenderScaleInput.js
 */
export function scaleFactorFromPivotScreen(pivotX, pivotY, startX, startY, currentX, currentY) {
  return scaleFactorFromPointer({
    pivotX,
    pivotY,
    startX,
    startY,
    clientX: currentX,
    clientY: currentY,
  });
}

/**
 * Scale mesh-local positions about a world pivot (uniform or per-axis in world space).
 * @param {[number, number, number][]} positions
 * @param {[number, number, number]} pivotLocal
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {number | [number, number, number]} factor
 * @param {[number, number, number] | null} [pivotWorld]
 */
export function scalePositionsInViewSpace(
  positions,
  pivotLocal,
  object,
  objects,
  factor,
  pivotWorld = null,
) {
  const factors =
    typeof factor === 'number'
      ? [Math.max(0.001, factor), Math.max(0.001, factor), Math.max(0.001, factor)]
      : [
          Math.max(0.001, factor[0]),
          Math.max(0.001, factor[1]),
          Math.max(0.001, factor[2]),
        ];

  if (pivotWorld) {
    _pivotWorld.set(pivotWorld[0], pivotWorld[1], pivotWorld[2]);
  } else {
    const pivotW = localToWorld(pivotLocal, object, objects);
    _pivotWorld.set(pivotW[0], pivotW[1], pivotW[2]);
  }

  return positions.map((p) => {
    const w = localToWorld(p, object, objects);
    _vertexWorld.set(w[0], w[1], w[2]).sub(_pivotWorld);
    _vertexWorld.x *= factors[0];
    _vertexWorld.y *= factors[1];
    _vertexWorld.z *= factors[2];
    _vertexWorld.add(_pivotWorld);
    return worldToLocal([_vertexWorld.x, _vertexWorld.y, _vertexWorld.z], object, objects);
  });
}

/** Min pointer orbit radius (px) — avoids unstable angles when the cursor sits on the pivot. */
export const MIN_ROTATE_ORBIT_RADIUS_PX = 10;

/**
 * Blender rotate: angle swept around pivot in the view plane (single step from start).
 * @deprecated Prefer advanceRotateAngleFromPointer for interactive drag — supports 360°+ spins.
 */
export function rotateAngleFromPivotScreen(pivotX, pivotY, startX, startY, currentX, currentY) {
  const startAngle = Math.atan2(startY - pivotY, startX - pivotX);
  const currentAngle = Math.atan2(currentY - pivotY, currentX - pivotX);
  let delta = currentAngle - startAngle;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta * ROTATE_MOUSE_GAIN;
}

/**
 * Accumulate rotation from frame-to-frame pointer orbit for smooth 360° spins.
 * @param {number} pivotX
 * @param {number} pivotY
 * @param {number} currentX
 * @param {number} currentY
 * @param {number | null} prevPointerAngleRad
 * @param {number} accumulatedAngleRad
 */
export function advanceRotateAngleFromPointer(
  pivotX,
  pivotY,
  currentX,
  currentY,
  prevPointerAngleRad,
  accumulatedAngleRad,
) {
  const orbitDist = Math.hypot(currentX - pivotX, currentY - pivotY);
  const pointerAngle = Math.atan2(currentY - pivotY, currentX - pivotX);

  if (orbitDist < MIN_ROTATE_ORBIT_RADIUS_PX) {
    return {
      pointerAngle: prevPointerAngleRad ?? pointerAngle,
      accumulatedAngle: accumulatedAngleRad,
      skipped: true,
    };
  }

  if (prevPointerAngleRad === null) {
    return { pointerAngle, accumulatedAngle: accumulatedAngleRad, skipped: false };
  }

  let step = pointerAngle - prevPointerAngleRad;
  if (step > Math.PI) step -= Math.PI * 2;
  if (step < -Math.PI) step += Math.PI * 2;

  return {
    pointerAngle,
    accumulatedAngle: accumulatedAngleRad + step * ROTATE_MOUSE_GAIN,
    skipped: false,
  };
}

/**
 * Rotate mesh-local positions around the current view axis (world space), like Blender R.
 * @param {[number, number, number][]} positions
 * @param {[number, number, number]} pivotLocal
 * @param {import('../store/editorStore.js').SceneObject} object
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {[number, number, number]} axisWorld
 * @param {number} angleRad
 * @param {[number, number, number] | null} [pivotWorld]
 */
export function rotatePositionsInViewSpace(
  positions,
  pivotLocal,
  object,
  objects,
  axisWorld,
  angleRad,
  pivotWorld = null,
) {
  if (Math.abs(angleRad) < 1e-8) {
    return positions.map((p) => [...p]);
  }
  _viewAxis.set(axisWorld[0], axisWorld[1], axisWorld[2]);
  if (_viewAxis.lengthSq() < 1e-12) _viewAxis.set(0, 0, -1);
  _viewAxis.normalize();
  _deltaQuat.setFromAxisAngle(_viewAxis, angleRad);

  if (pivotWorld) {
    _pivotWorld.set(pivotWorld[0], pivotWorld[1], pivotWorld[2]);
  } else {
    const pivotW = localToWorld(pivotLocal, object, objects);
    _pivotWorld.set(pivotW[0], pivotW[1], pivotW[2]);
  }

  return positions.map((p) => {
    const w = localToWorld(p, object, objects);
    _vertexWorld.set(w[0], w[1], w[2]).sub(_pivotWorld).applyQuaternion(_deltaQuat).add(_pivotWorld);
    return worldToLocal([_vertexWorld.x, _vertexWorld.y, _vertexWorld.z], object, objects);
  });
}
