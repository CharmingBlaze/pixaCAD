import { applyListSelection } from './selection.js';

/**
 * @param {import('./editorStore.js').EditorState} state
 * @returns {string[]}
 */
export function coalesceSelectedIds(state) {
  if (Array.isArray(state.selectedIds) && state.selectedIds.length > 0) {
    return [...state.selectedIds];
  }
  return state.selectedId ? [state.selectedId] : [];
}

/** @param {import('./editorStore.js').EditorState} state @param {string} objectId */
export function isObjectSelected(state, objectId) {
  if (Array.isArray(state.selectedIds) && state.selectedIds.length > 0) {
    return state.selectedIds.includes(objectId);
  }
  return state.selectedId === objectId;
}

/** @param {import('./editorStore.js').EditorState} state */
export function selectedObjectCount(state) {
  if (Array.isArray(state.selectedIds) && state.selectedIds.length > 0) {
    return state.selectedIds.length;
  }
  return state.selectedId ? 1 : 0;
}

/** @param {import('./editorStore.js').EditorState} state */
export function hasSelectedGroup(state) {
  const ids =
    Array.isArray(state.selectedIds) && state.selectedIds.length > 0
      ? state.selectedIds
      : state.selectedId
        ? [state.selectedId]
        : [];
  return ids.some((id) => state.objects.find((o) => o.id === id)?.isGroup);
}

/**
 * @param {import('./editorStore.js').SceneObject[]} objects
 * @param {string} ancestorId
 * @param {string} id
 */
export function isDescendantOf(objects, ancestorId, id) {
  let cur = objects.find((o) => o.id === id);
  while (cur?.parentId) {
    if (cur.parentId === ancestorId) return true;
    cur = objects.find((o) => o.id === cur.parentId);
  }
  return false;
}

/**
 * Drop selected ids that are ancestors of another selected id.
 * @param {import('./editorStore.js').SceneObject[]} objects
 * @param {string[]} ids
 */
export function filterOutAncestorSelections(objects, ids) {
  return ids.filter((id) => !ids.some((otherId) => otherId !== id && isDescendantOf(objects, id, otherId)));
}

/**
 * @param {string | null} id
 * @param {{ additive?: boolean, remove?: boolean }} options
 * @param {string[]} prevIds
 */
export function nextObjectSelection(id, options, prevIds) {
  if (!id) {
    return { selectedIds: [], selectedId: null };
  }

  let selectedIds;
  if (options.remove) {
    selectedIds = prevIds.filter((x) => x !== id);
  } else if (options.additive) {
    selectedIds = applyListSelection(prevIds, id, 'add');
  } else {
    selectedIds = [id];
  }

  if (selectedIds.length === 0) {
    return { selectedIds: [], selectedId: null };
  }

  const selectedId = selectedIds.includes(id) ? id : selectedIds[selectedIds.length - 1];
  return { selectedIds, selectedId };
}

/**
 * @param {string[]} ids
 * @param {'replace' | 'add' | 'remove'} mode
 * @param {string[]} prevIds
 */
export function nextObjectSelectionBatch(ids, mode, prevIds) {
  let selectedIds;
  if (mode === 'replace') {
    selectedIds = [...ids];
  } else if (mode === 'add') {
    selectedIds = [...new Set([...prevIds, ...ids])];
  } else {
    const remove = new Set(ids);
    selectedIds = prevIds.filter((id) => !remove.has(id));
  }

  if (selectedIds.length === 0) {
    return { selectedIds: [], selectedId: null };
  }

  const selectedId = selectedIds[selectedIds.length - 1];
  return { selectedIds, selectedId };
}
