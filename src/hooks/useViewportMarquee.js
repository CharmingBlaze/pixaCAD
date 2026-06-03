import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { isInteractionBlocked } from '../store/interaction.js';
import { normalizeMarqueeRect } from '../lib/selection/marquee.js';
import { collectMarqueeSelection } from '../lib/selection/marqueeSelect.js';

const DRAG_THRESHOLD_PX = 6;
const MIN_MARQUEE_PX = 4;

/**
 * DOM-level marquee selection for one viewport cell.
 * @param {string} slotId
 * @param {import('../components/viewport/viewportConfig.js').ViewportId} viewId
 * @param {HTMLElement | null} cellEl
 */
export function useViewportMarquee(slotId, viewId, cellEl) {
  const [box, setBox] = useState(
    /** @type {null | { left: number, top: number, width: number, height: number, crossing: boolean }} */ (null),
  );
  const sessionRef = useRef(
    /** @type {null | { pointerId: number, x0: number, y0: number, mode: import('../store/selection.js').SelectMode }} */ (null),
  );

  const selectObject = useEditorStore((s) => s.selectObject);
  const selectObjects = useEditorStore((s) => s.selectObjects);
  const clearSubSelection = useEditorStore((s) => s.clearSubSelection);
  const selectVerticesBatch = useEditorStore((s) => s.selectVerticesBatch);
  const selectEdgesBatch = useEditorStore((s) => s.selectEdgesBatch);
  const selectFacesBatch = useEditorStore((s) => s.selectFacesBatch);
  const setMarqueeActive = useEditorStore((s) => s.setMarqueeActive);

  const actionsRef = useRef({
    selectObject,
    selectObjects,
    clearSubSelection,
    selectVerticesBatch,
    selectEdgesBatch,
    selectFacesBatch,
    setMarqueeActive,
  });
  actionsRef.current = {
    selectObject,
    selectObjects,
    clearSubSelection,
    selectVerticesBatch,
    selectEdgesBatch,
    selectFacesBatch,
    setMarqueeActive,
  };

  useEffect(() => {
    const cell = cellEl;
    if (!cell) return undefined;

    const getHandle = () => useEditorStore.getState().viewportHandles[slotId];

    const clearMarquee = () => {
      sessionRef.current = null;
      setBox(null);
      actionsRef.current.setMarqueeActive(false);
    };

    const applySelection = (x0, y0, x1, y1, mode) => {
      const handle = getHandle();
      const canvas = handle?.canvas ?? cell.querySelector('canvas');
      if (!handle?.camera || !canvas) return;

      const st = useEditorStore.getState();
      const domRect = canvas.getBoundingClientRect();
      const marqueeRect = normalizeMarqueeRect(x0, y0, x1, y1);
      const object = st.objects.find((o) => o.id === st.selectedId) ?? null;
      const result = collectMarqueeSelection({
        editMode: st.editMode,
        objects: st.objects,
        selectedId: st.selectedId,
        object,
        mesh: object?.mesh ?? null,
        camera: handle.camera,
        domRect,
        marqueeRect,
      });

      const { selectObject: pickObj, clearSubSelection: clearSub, selectVerticesBatch: pickVerts, selectEdgesBatch: pickEdges, selectFacesBatch: pickFaces } =
        actionsRef.current;

      if (result.targetId && result.targetId !== st.selectedId) {
        pickObj(result.targetId);
      }

      if (st.editMode === 'object') {
        const objectIds = result.objectIds ?? [];
        if (objectIds.length > 0) {
          actionsRef.current.selectObjects(objectIds, mode);
        } else if (mode === 'replace') {
          pickObj(null);
        }
        return;
      }

      if (st.editMode === 'vertex') {
        if (result.vertices.length > 0) pickVerts(result.vertices, mode);
        else if (mode === 'replace') clearSub();
        return;
      }

      if (st.editMode === 'edge') {
        if (result.edges.length > 0) pickEdges(result.edges, mode);
        else if (mode === 'replace') clearSub();
        return;
      }

      if (st.editMode === 'face') {
        if (result.faces.length > 0) pickFaces(result.faces, mode);
        else if (mode === 'replace') clearSub();
      }
    };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (!(e.target instanceof Element) || !cell.contains(e.target)) return;
      if (e.target.closest('.viewportCellMenu')) return;

      const st = useEditorStore.getState();
      if (isInteractionBlocked(st)) return;
      const pixelPaintActive =
        st.pixelEditorOpen &&
        st.pixelPaintOnModel &&
        (st.pixelTool === 'brush' ||
          st.pixelTool === 'pencil' ||
          st.pixelTool === 'eraser' ||
          st.pixelTool === 'fill');
      if (pixelPaintActive) return;
      // Always track LMB so drag can become a marquee; click-vs-drag is decided on release.
      sessionRef.current = {
        pointerId: e.pointerId,
        x0: e.clientX,
        y0: e.clientY,
        mode: e.altKey ? 'remove' : e.shiftKey ? 'add' : 'replace',
      };
    };

    const onPointerMove = (e) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.x0;
      const dy = e.clientY - session.y0;
      if (!useEditorStore.getState().marqueeActive) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        actionsRef.current.setMarqueeActive(true);
        try {
          cell.setPointerCapture(e.pointerId);
        } catch {
          /* already captured */
        }
      }

      const cellRect = cell.getBoundingClientRect();
      setBox({
        left: Math.min(session.x0, e.clientX) - cellRect.left,
        top: Math.min(session.y0, e.clientY) - cellRect.top,
        width: Math.abs(e.clientX - session.x0),
        height: Math.abs(e.clientY - session.y0),
        crossing: e.clientX < session.x0,
      });
      e.preventDefault();
    };

    const finish = (e) => {
      const session = sessionRef.current;
      if (!session || session.pointerId !== e.pointerId) return;

      const dx = e.clientX - session.x0;
      const dy = e.clientY - session.y0;
      const wasMarquee = useEditorStore.getState().marqueeActive;

      if (wasMarquee) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= MIN_MARQUEE_PX) {
          applySelection(session.x0, session.y0, e.clientX, e.clientY, session.mode);
        }
        e.preventDefault();
      }

      try {
        cell.releasePointerCapture(e.pointerId);
      } catch {
        /* ok */
      }

      clearMarquee();
    };

    cell.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);

    return () => {
      cell.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      clearMarquee();
    };
  }, [slotId, viewId, cellEl]);

  return box;
}
