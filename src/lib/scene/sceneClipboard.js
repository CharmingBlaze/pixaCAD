import { uid } from '../id.js';
import { snapshotObjects, restoreObjects } from '../../store/historyHelpers.js';
import { coalesceSelectedIds } from '../../store/objectSelection.js';

/**
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {string[]} rootIds
 */
export function collectObjectSubtree(objects, rootIds) {
  const result = [];
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) return;
    const obj = objects.find((o) => o.id === id);
    if (!obj) return;
    seen.add(id);
    result.push(obj);
    objects.filter((o) => o.parentId === id).forEach((child) => walk(child.id));
  };
  for (const id of rootIds) walk(id);
  return result;
}

/**
 * @param {import('../../store/historyHelpers.js').SceneObjectSnapshot[]} snapshots
 * @param {[number, number, number]} offset
 */
export function pasteObjectSnapshots(snapshots, offset = [0.5, 0, 0.5]) {
  const restored = restoreObjects(snapshots);
  const idMap = new Map(restored.map((o) => [o.id, uid()]));
  const roots = restored.filter((o) => !o.parentId || !idMap.has(o.parentId));
  return restored.map((src) => ({
    ...src,
    id: idMap.get(src.id),
    name: `${src.name}_copy`,
    parentId: src.parentId && idMap.has(src.parentId) ? idMap.get(src.parentId) : null,
    mesh: src.mesh ? src.mesh.clone() : null,
    textureLayers: src.textureLayers?.map((layer) => ({ ...layer })) ?? [],
    textureRevision: 0,
    position: roots.some((r) => r.id === src.id)
      ? [src.position[0] + offset[0], src.position[1] + offset[1], src.position[2] + offset[2]]
      : [...src.position],
    locked: false,
  }));
}

/**
 * @param {import('../../store/editorStore.js').SceneObject[]} objects
 * @param {string[]} rootIds
 */
export function snapshotSelectedSubtree(objects, rootIds) {
  return snapshotObjects(collectObjectSubtree(objects, rootIds));
}

/** @param {import('../../store/editorStore.js').EditorState} state */
export function copySelectionSnapshots(state) {
  const ids = coalesceSelectedIds(state);
  if (!ids.length) return null;
  return snapshotSelectedSubtree(state.objects, ids);
}

/** @param {import('../../store/editorStore.js').SceneObject[]} objects @param {string[]} rootIds @param {[number, number, number]} offset */
export function duplicateSubtrees(objects, rootIds, offset = [0.5, 0, 0.5]) {
  const snapshots = snapshotSelectedSubtree(objects, rootIds);
  return pasteObjectSnapshots(snapshots, offset);
}
