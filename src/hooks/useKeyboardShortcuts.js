import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { coalesceSelectedIds } from '../store/objectSelection.js';
import { isInteractionBlocked } from '../store/interaction.js';
import { isPolyDrawEngaged } from '../store/toolState.js';
import { saveProject } from '../export/project.js';

/** @param {import('../store/editorStore.js').EditorState} store */
function hasTransformableSelection(store) {
  if (!store.selectedId) return false;
  if (store.editMode === 'object') return coalesceSelectedIds(store).length > 0;
  if (store.editMode === 'vertex') return store.selectedVertices.length > 0;
  if (store.editMode === 'edge') return store.selectedEdges.length > 0;
  if (store.editMode === 'face') return store.selectedFaces.length > 0;
  return false;
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const store = useEditorStore.getState();
      const key = e.key.toLowerCase();

      if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault();
        store.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 's' && !e.shiftKey) {
        e.preventDefault();
        saveProject(store)
          .then(() => {
            store.markSceneSaved();
            store.setStatus('Project saved');
          })
          .catch((err) => store.setStatus(`Project save failed: ${err.message}`));
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (isInteractionBlocked(store)) return;
        const hasObjectSelection = coalesceSelectedIds(store).length > 0;
        const hasSubSelection =
          !!store.selectedId &&
          ((store.editMode === 'vertex' && store.selectedVertices.length > 0) ||
            (store.editMode === 'edge' && store.selectedEdges.length > 0) ||
            (store.editMode === 'face' && store.selectedFaces.length > 0));
        if (store.editMode === 'object' && !hasObjectSelection) return;
        if (store.editMode !== 'object' && !hasSubSelection) return;
        e.preventDefault();
        store.nudgeSelectionByArrow(
          /** @type {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} */ (e.key),
          { shiftKey: e.shiftKey },
        );
        return;
      }

      if (key === 'escape') {
        e.preventDefault();
        // Esc cancels active tools first; only then clears selection.
        if (store.interactiveTransformActive) {
          store.cancelInteractiveTransform();
          return;
        }
        if (store.vertexManipActive || store.vertexManipSession) {
          store.cancelVertexManip();
          return;
        }
        if (store.knifeActive || store.knifeStart) {
          store.cancelKnifeTool();
          return;
        }
        if (store.extrudeActive) {
          store.cancelExtrudeSession();
          return;
        }
        if (store.loopCutActive) {
          store.cancelLoopCutSession();
          return;
        }
        if (store.bevelActive) {
          store.cancelBevelSession();
          return;
        }
        if (isPolyDrawEngaged(store)) {
          store.cancelPolyDraw();
          return;
        }
        if (store.pendingPrimitive || store.drawPhase !== 'idle') {
          store.cancelPrimitiveDraw();
          return;
        }
        if (store.gizmoAxisLock) {
          store.setGizmoAxisLock(null);
          return;
        }
        store.clearAllSelection();
        return;
      }

      if (key === 'backspace' && store.polyDrawActive) {
        e.preventDefault();
        store.undoPolyDrawPoint();
        return;
      }

      if (key === 'enter' && store.polyDrawActive) {
        e.preventDefault();
        store.fillPolyDrawFace();
        return;
      }

      if (key === 'i' && store.editMode === 'face' && store.selectedFaces.length > 0) {
        e.preventDefault();
        store.insetSelection();
        return;
      }

      if (key === 'delete' || (key === 'backspace' && !store.polyDrawActive)) {
        if (store.editMode === 'object') {
          if (store.selectedId) {
            e.preventDefault();
            store.removeSelected();
          }
          return;
        }
        if (
          (store.editMode === 'vertex' && store.selectedVertices.length) ||
          (store.editMode === 'edge' && store.selectedEdges.length) ||
          (store.editMode === 'face' && store.selectedFaces.length)
        ) {
          e.preventDefault();
          store.deleteSubSelection();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.shiftKey && key === 's') {
          e.preventDefault();
          store.snapSelectionToGrid();
          return;
        }
        if (key === 'b' && store.editMode === 'edge' && store.selectedEdges.length > 0) {
          e.preventDefault();
          if (store.bevelActive) store.confirmBevelSession();
          else store.startBevelSession();
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          store.copySelectedObject();
          return;
        }
        if (key === 'v') {
          e.preventDefault();
          store.pasteClipboardObject();
          return;
        }
        if (key === 'd') {
          e.preventDefault();
          store.duplicateSelected();
        }
        return;
      }

      if (e.altKey && key === 'z') {
        e.preventDefault();
        store.toggleXRay();
        return;
      }

      if (key === 'enter' && store.extrudeActive) {
        e.preventDefault();
        store.confirmExtrudeSession();
        return;
      }

      if (key === 'enter' && store.loopCutActive) {
        e.preventDefault();
        store.confirmLoopCutSession();
        return;
      }

      if (key === 'enter' && store.bevelActive) {
        e.preventDefault();
        store.confirmBevelSession();
        return;
      }

      if (key === 'enter' && store.interactiveTransformActive) {
        e.preventDefault();
        store.confirmInteractiveTransform();
        return;
      }

      if (
        key === 'e' &&
        ((store.editMode === 'face' && store.selectedFaces.length) ||
          (store.editMode === 'edge' && store.selectedEdges.length) ||
          (store.polyDrawActive && store.selectedFaces.length)) &&
        !store.extrudeActive &&
        !store.bevelActive &&
        !store.loopCutActive &&
        !store.pendingPrimitive &&
        !store.knifeActive
      ) {
        e.preventDefault();
        store.extrudeSelection();
        return;
      }

      if (
        key === 'k' &&
        !store.extrudeActive &&
        !store.polyDrawActive &&
        !store.pendingPrimitive
      ) {
        e.preventDefault();
        if (store.knifeActive) store.cancelKnifeTool();
        else store.startKnifeTool();
        return;
      }

      if (key === 'j' && store.editMode === 'edge' && store.selectedEdges.length) {
        e.preventDefault();
        store.splitSelectedEdges();
        return;
      }

      if (
        key === 'm' &&
        ((store.editMode === 'vertex' && store.selectedVertices.length >= 2) ||
          (store.editMode === 'edge' && store.selectedEdges.length > 0) ||
          (store.editMode === 'face' && store.selectedFaces.length > 0))
      ) {
        e.preventDefault();
        store.mergeSelection();
        return;
      }

      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        key === 's' &&
        hasTransformableSelection(store)
      ) {
        e.preventDefault();
        store.startInteractiveTransform('scale');
        return;
      }

      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        key === 'r' &&
        hasTransformableSelection(store)
      ) {
        e.preventDefault();
        store.startInteractiveTransform('rotate');
        return;
      }

      if (
        key === 'l' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        store.editMode === 'edge' &&
        store.selectedEdges.length
      ) {
        e.preventDefault();
        if (store.loopCutActive) store.confirmLoopCutSession();
        else store.startLoopCutSession();
        return;
      }

      if (e.shiftKey && key === 'l' && store.editMode === 'edge' && store.selectedEdges.length) {
        e.preventDefault();
        store.selectEdgeLoop();
        return;
      }

      if (e.altKey && key === 'r' && store.editMode === 'edge' && store.selectedEdges.length) {
        e.preventDefault();
        store.selectEdgeRing();
        return;
      }

      if (key === 'b' && store.editMode === 'edge' && store.selectedEdges.length && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (store.bevelActive) store.confirmBevelSession();
        else store.startBevelSession();
        return;
      }

      if (key === 'f') {
        if (e.shiftKey && store.editMode === 'face' && store.selectedFaces.length) {
          e.preventDefault();
          store.applyPaintToSelection();
          return;
        }
        e.preventDefault();
        store.makeFaceFromSelection();
        return;
      }

      const modes = { 1: 'object', 2: 'vertex', 3: 'edge', 4: 'face' };
      if (modes[e.key]) {
        store.setEditMode(/** @type {import('../store/editorStore.js').EditMode} */ (modes[e.key]));
        return;
      }

      const transforms = { g: 'translate', r: 'rotate', s: 'scale' };
      if (transforms[key]) {
        store.setTransformMode(transforms[key]);
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const lockAxis = { x: 'X', y: 'Y', z: 'Z' }[key];
        if (lockAxis && store.selectedId) {
          if (
            store.interactiveTransformActive &&
            store.interactiveTransformMode === 'scale'
          ) {
            e.preventDefault();
            store.setGizmoAxisLock(lockAxis);
            store.setStatus(`Scale locked to ${lockAxis} axis`);
            return;
          }
          if (
            store.editMode === 'object' &&
            store.transformMode === 'translate'
          ) {
            e.preventDefault();
            store.setGizmoAxisLock(lockAxis);
            store.setStatus(`Translate locked to ${lockAxis}`);
            return;
          }
        }
      }

      if (key === 'w') store.toggleWireframe();
      if (e.altKey && key === 'x') store.mirrorSelection('x');
    };

    const onKeyUp = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key !== 'x' && key !== 'y' && key !== 'z') return;
      const store = useEditorStore.getState();
      if (!store.gizmoAxisLock) return;
      store.setGizmoAxisLock(null);
      if (store.interactiveTransformActive && store.interactiveTransformMode === 'scale') {
        store.setStatus('Scale axis unlocked');
      } else if (store.editMode === 'object' && store.transformMode === 'translate') {
        store.setStatus('Translate axis unlocked');
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);
}
