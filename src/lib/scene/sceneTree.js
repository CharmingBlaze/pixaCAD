/** @typedef {import('../../store/editorStore.js').SceneObject} SceneObject */

/**
 * @param {SceneObject[]} objects
 * @returns {Map<string | '__root__', SceneObject[]>}
 */
export function buildChildrenMap(objects) {
  const byParent = new Map();
  for (const o of objects) {
    const pid = o.parentId ?? '__root__';
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid).push(o);
  }
  return byParent;
}

/**
 * @param {SceneObject[]} objects
 */
export function getRootObjects(objects) {
  return objects.filter((o) => !o.parentId);
}
