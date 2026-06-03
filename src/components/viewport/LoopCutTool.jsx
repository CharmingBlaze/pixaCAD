import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';

const SLIDE_PIXEL_SCALE = 0.004;

/**
 * Blender-style loop cut: slide to position, scroll for more cuts, click to confirm.
 */
export function LoopCutTool() {
  const { gl } = useThree();
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const updateLoopCutFactor = useEditorStore((s) => s.updateLoopCutFactor);
  const adjustLoopCutCuts = useEditorStore((s) => s.adjustLoopCutCuts);
  const confirmLoopCutSession = useEditorStore((s) => s.confirmLoopCutSession);

  const dragRef = useRef({ startY: 0, startFactor: 0.5, ready: false });

  useEffect(() => {
    if (!loopCutActive) return;

    dragRef.current = {
      startY: 0,
      startFactor: useEditorStore.getState().loopCutFactor,
      ready: false,
    };

    const onMove = (e) => {
      const ref = dragRef.current;
      if (!ref.ready) {
        ref.startY = e.clientY;
        ref.startFactor = useEditorStore.getState().loopCutFactor;
        ref.ready = true;
      }
      const next = ref.startFactor + (ref.startY - e.clientY) * SLIDE_PIXEL_SCALE;
      updateLoopCutFactor(next);
    };

    const onDown = (e) => {
      if (e.button !== 0 || !dragRef.current.ready) return;
      e.preventDefault();
      e.stopPropagation();
      confirmLoopCutSession();
    };

    const onWheel = (e) => {
      if (!useEditorStore.getState().loopCutActive) return;
      e.preventDefault();
      e.stopPropagation();
      adjustLoopCutCuts(e.deltaY > 0 ? 1 : -1);
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
  }, [loopCutActive, gl, updateLoopCutFactor, adjustLoopCutCuts, confirmLoopCutSession]);

  return null;
}
