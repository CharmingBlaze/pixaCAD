import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';
import {
  buildExtrudeDragContext,
  extrudeDistanceFromPointer,
  extrudeWheelStep,
} from '../../lib/viewport/blenderExtrudeInput.js';

/**
 * Blender-style modal extrude: drag along the extrusion axis in screen space,
 * scroll to nudge, Shift for precision, click to confirm.
 */
export function ExtrudeTool() {
  const { gl, camera, size } = useThree();
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const updateExtrudeDistance = useEditorStore((s) => s.updateExtrudeDistance);
  const confirmExtrudeSession = useEditorStore((s) => s.confirmExtrudeSession);

  const dragRef = useRef(
    /** @type {null | {
     *   startClientX: number,
     *   startClientY: number,
     *   context: ReturnType<typeof buildExtrudeDragContext>,
     *   ready: boolean,
     * }} */ (null),
  );

  useEffect(() => {
    if (!extrudeActive) {
      dragRef.current = null;
      return;
    }

    const st = useEditorStore.getState();
    const context = buildExtrudeDragContext(st, camera, gl.domElement);
    if (!context) return;

    dragRef.current = {
      startClientX: 0,
      startClientY: 0,
      context,
      ready: false,
    };

    const onMove = (e) => {
      const ref = dragRef.current;
      if (!ref) return;

      if (!ref.ready) {
        ref.startClientX = e.clientX;
        ref.startClientY = e.clientY;
        ref.context.startDistance = useEditorStore.getState().extrudeDistance;
        ref.ready = true;
      }

      const distance = extrudeDistanceFromPointer({
        startClientX: ref.startClientX,
        startClientY: ref.startClientY,
        clientX: e.clientX,
        clientY: e.clientY,
        startDistance: ref.context.startDistance,
        screenDir: ref.context.screenDir,
        worldExtent: ref.context.worldExtent,
        shiftKey: e.shiftKey,
      });

      updateExtrudeDistance(distance);
    };

    const onDown = (e) => {
      const ref = dragRef.current;
      if (e.button !== 0 || !ref?.ready) return;
      e.preventDefault();
      e.stopPropagation();
      confirmExtrudeSession();
    };

    const onWheel = (e) => {
      const st = useEditorStore.getState();
      if (!st.extrudeActive || !dragRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      const step = extrudeWheelStep(dragRef.current.context.worldExtent, e.shiftKey);
      const sign = e.deltaY < 0 ? 1 : -1;
      updateExtrudeDistance(st.extrudeDistance + sign * step);
      dragRef.current.context.startDistance = useEditorStore.getState().extrudeDistance;
    };

    const el = gl.domElement;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    el.addEventListener('wheel', onWheel, { passive: false, capture: true });

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('wheel', onWheel, { capture: true });
      el.removeEventListener('wheel', onWheel, { capture: false });
    };
  }, [extrudeActive, gl, camera, size.width, size.height, updateExtrudeDistance, confirmExtrudeSession]);

  return null;
}
