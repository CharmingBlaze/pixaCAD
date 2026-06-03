/** @typedef {'object' | 'vertex' | 'edge' | 'face'} SelectionLevel */
/** @typedef {'replace' | 'add' | 'remove'} SelectMode */

/**
 * Blockbench-style modifiers: Shift add/toggle, Ctrl remove, plain click replace.
 * @param {Pick<PointerEvent, 'shiftKey' | 'ctrlKey' | 'metaKey'>} e
 * @returns {SelectMode}
 */
export function selectModeFromEvent(e) {
  if (e.ctrlKey || e.metaKey) return 'remove';
  if (e.shiftKey) return 'add';
  return 'replace';
}

/**
 * @template T
 * @param {T[]} list
 * @param {T} item
 * @param {SelectMode} mode
 */
export function applyListSelection(list, item, mode) {
  if (mode === 'replace') return [item];
  if (mode === 'add') {
    return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
  }
  return list.filter((x) => x !== item);
}

/**
 * @param {import('./editorStore.js').EditorState} state
 */
export function getSelectionSummary(state) {
  const { editMode, selectedVertices, selectedEdges, selectedFaces, selectedId, objects } = state;
  if (editMode === 'vertex' && selectedVertices.length) {
    const n = selectedVertices.length;
    return `${n} vertex${n === 1 ? '' : 'es'} selected`;
  }
  if (editMode === 'edge' && selectedEdges.length) {
    const n = selectedEdges.length;
    return `${n} edge${n === 1 ? '' : 's'} selected`;
  }
  if (editMode === 'face' && selectedFaces.length) {
    const n = selectedFaces.length;
    return `${n} face${n === 1 ? '' : 's'} selected`;
  }
  const objectIds =
    Array.isArray(state.selectedIds) && state.selectedIds.length > 0
      ? state.selectedIds
      : selectedId
        ? [selectedId]
        : [];
  if (objectIds.length > 1) {
    return `${objectIds.length} objects selected`;
  }
  if (objectIds.length === 1) {
    const obj = objects.find((o) => o.id === objectIds[0]);
    return obj ? obj.name : '1 object';
  }
  return 'Nothing selected';
}

/**
 * @param {import('./editorStore.js').EditorState} state
 * @returns {SelectionLevel}
 */
export function getActiveSelectionLevel(state) {
  if (state.editMode !== 'object') return state.editMode;
  return state.selectedId ? 'object' : 'object';
}
