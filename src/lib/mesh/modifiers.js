import { mirrorMesh, subdivideFaces } from './operations.js';

/**
 * @typedef {Object} MeshModifiers
 * @property {boolean} [mirrorEnabled]
 * @property {'x' | 'y' | 'z'} [mirrorAxis]
 * @property {number} [subdivisionLevel]
 */

/** @param {MeshModifiers | undefined | null} modifiers */
export function normalizeMeshModifiers(modifiers) {
  const axis = modifiers?.mirrorAxis === 'y' || modifiers?.mirrorAxis === 'z' ? modifiers.mirrorAxis : 'x';
  const subdivisionLevel = modifiers?.subdivisionLevel ? 1 : 0;
  return {
    mirrorEnabled: !!modifiers?.mirrorEnabled,
    mirrorAxis: axis,
    subdivisionLevel,
  };
}

/**
 * Applies lightweight non-destructive mesh modifiers for viewport/export.
 * The stack is intentionally tiny for game-friendly low-poly work:
 * mirror first, then at most one subdivision pass.
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
  if (normalized.subdivisionLevel > 0) {
    result = subdivideFaces(result, result.faces.map((_, index) => index));
  }
  return result;
}

/** @param {import('../../store/editorStore.js').SceneObject} object */
export function evaluateObjectMesh(object) {
  return evaluateMeshModifiers(object?.mesh, object?.meshModifiers);
}
