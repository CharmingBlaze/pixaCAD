import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import {
  applyTransformGizmoTheme,
  installTransformGizmoThemeHook,
} from '../../lib/gizmo/applyTransformGizmoTheme.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { useEditorStore } from '../../store/editorStore.js';

/**
 * TransformControls with gizmo colors driven by the active UI theme (translate, rotate, scale).
 * @param {import('@react-three/drei').TransformControlsProps} props
 */
export function ThemedTransformControls({ ref: forwardedRef, mode, ...props }) {
  const innerRef = useRef(null);
  const orbitControls = useThree((s) => s.controls);
  const vpTheme = useViewportTheme();
  const themeRef = useRef(vpTheme);
  themeRef.current = vpTheme;

  const bindGizmoTheme = useCallback((controls) => {
    if (!controls) return;
    installTransformGizmoThemeHook(controls, () => themeRef.current);
  }, []);

  const setRef = useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
      bindGizmoTheme(node);
    },
    [forwardedRef, bindGizmoTheme],
  );

  useLayoutEffect(() => {
    const controls = innerRef.current;
    if (!controls) return;
    applyTransformGizmoTheme(controls, vpTheme);
    bindGizmoTheme(controls);
  }, [vpTheme, mode, bindGizmoTheme]);

  // Ensure orbit/pan is never left disabled if a gizmo drag ends oddly (common with grouped objects).
  useLayoutEffect(() => {
    const tc = innerRef.current;
    if (!tc || !orbitControls) return;

    const onDragging = (event) => {
      orbitControls.enabled = !event.value;
    };
    const releaseOrbit = () => {
      if (tc.dragging) tc.dragging = false;
      orbitControls.enabled = true;
    };

    const setGizmoInteracting = useEditorStore.getState().setGizmoInteracting;
    const onGizmoDown = () => setGizmoInteracting(true);
    const onGizmoUp = () => setGizmoInteracting(false);

    tc.addEventListener('dragging-changed', onDragging);
    tc.addEventListener('mouseDown', onGizmoDown);
    tc.addEventListener('mouseUp', onGizmoUp);
    tc.addEventListener('mouseUp', releaseOrbit);
    window.addEventListener('pointerup', releaseOrbit);
    window.addEventListener('pointercancel', releaseOrbit);
    window.addEventListener('pointerup', onGizmoUp);
    window.addEventListener('pointercancel', onGizmoUp);

    return () => {
      tc.removeEventListener('dragging-changed', onDragging);
      tc.removeEventListener('mouseDown', onGizmoDown);
      tc.removeEventListener('mouseUp', onGizmoUp);
      tc.removeEventListener('mouseUp', releaseOrbit);
      window.removeEventListener('pointerup', releaseOrbit);
      window.removeEventListener('pointercancel', releaseOrbit);
      window.removeEventListener('pointerup', onGizmoUp);
      window.removeEventListener('pointercancel', onGizmoUp);
      if (tc.dragging) tc.dragging = false;
      orbitControls.enabled = true;
      setGizmoInteracting(false);
    };
  }, [orbitControls, mode]);

  return <TransformControls ref={setRef} mode={mode} {...props} />;
}
