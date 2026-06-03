import { mirrorMesh, subdivideFaces } from './operations.js';

/** @type {5} */
export const MAX_MESH_SUBDIVISION_LEVEL = 5;

/**
 * @typedef {Object} MeshModifiers
 * @property {boolean} [mirrorEnabled]
 * @property {'x' | 'y' | 'z'} [mirrorAxis]
 * @property {number} [subdivisionLevel]
 */

/** @param {number | undefined | null} level */
export function clampSubdivisionLevel(level) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_MESH_SUBDIVISION_LEVEL, n);
}

/** @param {MeshModifiers | undefined | null} modifiers */
export function normalizeMeshModifiers(modifiers) {
  const axis = modifiers?.mirrorAxis === 'y' || modifiers?.mirrorAxis === 'z' ? modifiers.mirrorAxis : 'x';
  return {
    mirrorEnabled: !!modifiers?.mirrorEnabled,
    mirrorAxis: axis,
    subdivisionLevel: clampSubdivisionLevel(modifiers?.subdivisionLevel),
  };
}

/**
 * Applies lightweight non-destructive mesh modifiers for viewport/export.
 * The stack is intentionally tiny for game-friendly low-poly work:
 * mirror first, then up to five subdivision passes.
 *
 * @param {import('./EditableMesh.js').EditableMesh | null | undefined} mesh
 * @param {MeshModifiers | undefined | null} modifiers
 */
export function evaluateMeshModifiers(mesh, modifiers) {
  if (!mesh) return null;
  const normalized = normalizeMeshModifiers(modifiers);
  if (!normalized.mirrorEnabled && normalized.subdivisionLevel <= 0) return mesh;

  let result = mesh;
  if (normalized.mirrorEnabled) {
    result = mirrorMesh(result, normalized.mirrorAxis);
  }
  for (let level = 0; level < normalized.subdivisionLevel; level += 1) {
    result = subdivideFaces(result, result.faces.map((_, index) => index));
  }
  return result;
}

/** @param {import('../../store/editorStore.js').SceneObject} object */
export function evaluateObjectMesh(object) {
  return evaluateMeshModifiers(object?.mesh, object?.meshModifiers);
}
