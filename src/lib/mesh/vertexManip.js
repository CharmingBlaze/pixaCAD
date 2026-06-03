import * as THREE from 'three';
import { translateVertices } from './operations.js';

const _vec = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _axis = new THREE.Vector3();

/**
 * @param {[number, number, number]} delta
 * @param {boolean} snapGrid
 * @param {number} gridSize
 * @returns {[number, number, number]}
 */
export function snapVertexDelta(delta, snapGrid, gridSize) {
  if (!snapGrid) return delta;
  const g = gridSize;
  return [
    Math.round(delta[0] / g) * g,
    Math.round(delta[1] / g) * g,
    Math.round(delta[2] / g) * g,
  ];
}

/**
 * Move vertices from frozen start positions by a local-space delta.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {[number, number, number][]} startPositions parallel to vertexIndices
 * @param {[number, number, number]} delta
 */
export function meshWithVertexDelta(mesh, vertexIndices, startPositions, delta) {
  const next = mesh.clone();
  vertexIndices.forEach((vi, i) => {
    const p = startPositions[i];
    next.setPosition(vi, p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]);
  });
  return next;
}

/**
 * Replace selected vertices with explicit local-space positions.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {[number, number, number][]} positions parallel to vertexIndices
 */
export function meshWithVertexPositions(mesh, vertexIndices, positions) {
  const next = mesh.clone();
  vertexIndices.forEach((vi, i) => {
    const p = positions[i];
    if (!p) return;
    next.setPosition(vi, p[0], p[1], p[2]);
  });
  return next;
}

/**
 * Write vertex positions on an existing mesh (no clone) — used during live drag.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {[number, number, number][]} positions
 */
export function applyPositionsToMeshInPlace(mesh, vertexIndices, positions) {
  vertexIndices.forEach((vi, i) => {
    const p = positions[i];
    if (!p) return;
    mesh.setPosition(vi, p[0], p[1], p[2]);
  });
}

/**
 * Convenience: delta from current mesh positions (keyboard nudge, etc.).
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {[number, number, number]} delta
 */
export function meshTranslateVertices(mesh, vertexIndices, delta) {
  return translateVertices(mesh, vertexIndices, delta);
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 */
export function captureVertexPositions(mesh, vertexIndices) {
  return vertexIndices.map((vi) => {
    const p = mesh.getPosition(vi);
    return [p[0], p[1], p[2]];
  });
}

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @returns {[number, number, number]}
 */
export function vertexCentroid(mesh, vertexIndices) {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (const vi of vertexIndices) {
    const p = mesh.getPosition(vi);
    cx += p[0];
    cy += p[1];
    cz += p[2];
  }
  const n = vertexIndices.length || 1;
  return [cx / n, cy / n, cz / n];
}

/**
 * Uniform scale of vertex positions about a pivot.
 * @param {[number, number, number][]} positions
 * @param {[number, number, number]} pivot
 * @param {number} factor
 */
export function scalePositionsFromPivot(positions, pivot, factor) {
  const f = Math.max(0.001, factor);
  const [cx, cy, cz] = pivot;
  return positions.map(([x, y, z]) => [
    cx + (x - cx) * f,
    cy + (y - cy) * f,
    cz + (z - cz) * f,
  ]);
}

/**
 * Rotate vertex positions about an axis through a pivot (mesh local space).
 * @param {[number, number, number][]} positions
 * @param {[number, number, number]} pivot
 * @param {[number, number, number]} axis
 * @param {number} angleRad
 */
export function rotatePositionsFromPivot(positions, pivot, axis, angleRad) {
  if (Math.abs(angleRad) < 1e-8) {
    return positions.map((p) => [...p]);
  }
  _axis.set(axis[0], axis[1], axis[2]);
  if (_axis.lengthSq() < 1e-12) _axis.set(0, 1, 0);
  _axis.normalize();
  _quat.setFromAxisAngle(_axis, angleRad);
  const [cx, cy, cz] = pivot;
  return positions.map(([x, y, z]) => {
    _vec.set(x - cx, y - cy, z - cz).applyQuaternion(_quat);
    return [cx + _vec.x, cy + _vec.y, cz + _vec.z];
  });
}
