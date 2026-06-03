import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';

const SLIDE_PIXEL_SCALE = 0.003;

/**
 * Blender-style edge bevel: slide width, scroll for segments, click to confirm.
 */
export function BevelTool() {
  const { gl } = useThree();
  const bevelActive = useEditorStore((s) => s.bevelActive);
  const updateBevelAmount = useEditorStore((s) => s.updateBevelAmount);
  const adjustBevelSegments = useEditorStore((s) => s.adjustBevelSegments);
  const confirmBevelSession = useEditorStore((s) => s.confirmBevelSession);

  const dragRef = useRef({ startY: 0, startAmount: 0.15, ready: false });

  useEffect(() => {
    if (!bevelActive) return;

    dragRef.current = {
      startY: 0,
      startAmount: useEditorStore.getState().bevelAmount,
      ready: false,
    };

    const onMove = (e) => {
      const ref = dragRef.current;
      if (!ref.ready) {
        ref.startY = e.clientY;
        ref.startAmount = useEditorStore.getState().bevelAmount;
        ref.ready = true;
      }
      updateBevelAmount(ref.startAmount + (ref.startY - e.clientY) * SLIDE_PIXEL_SCALE);
    };

    const onDown = (e) => {
      if (e.button !== 0 || !dragRef.current.ready) return;
      e.preventDefault();
      e.stopPropagation();
      confirmBevelSession();
    };

    const onWheel = (e) => {
      if (!useEditorStore.getState().bevelActive) return;
      e.preventDefault();
      e.stopPropagation();
      adjustBevelSegments(e.deltaY > 0 ? 1 : -1);
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
  }, [bevelActive, gl, updateBevelAmount, adjustBevelSegments, confirmBevelSession]);

  return null;
}
