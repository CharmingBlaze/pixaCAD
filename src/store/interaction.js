import { isPolyDrawEngaged } from './toolState.js';

/**
 * Shared guards for viewport tools (pick, drag, orbit, gizmos).
 * @param {import('./editorStore.js').EditorState} state
 */
export function isInteractionBlocked(state) {
  return !!(
    state.pendingPrimitive ||
    isPolyDrawEngaged(state) ||
    state.extrudeActive ||
    state.loopCutActive ||
    state.bevelActive ||
    state.knifeActive ||
    state.interactiveTransformActive ||
    state.gizmoInteracting ||
    (state.vertexManipActive && state.vertexManipSession)
  );
}

/**
 * @param {import('./editorStore.js').EditorState} state
 */
export function isVertexManipActive(state) {
  return !!(state.vertexManipActive && state.vertexManipSession);
}

/**
 * Viewport mesh clicks may select objects unless a tool fully owns the pointer.
 * Poly draw / vertex mode do not block picking — selectObject finalizes those sessions.
 * @param {import('./editorStore.js').EditorState} state
 */
export function canViewportPickObject(state) {
  return !(state.pendingPrimitive || state.extrudeActive || state.knifeActive);
}

/**
 * Object-level viewport pick (replaces selection). Sub-object modes use their own pickers.
 * @param {import('./editorStore.js').EditorState} state
 */
export function shouldViewportSelectObject(state) {
  return state.editMode === 'object' && canViewportPickObject(state);
}
