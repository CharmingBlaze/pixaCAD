import { useEffect, useLayoutEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';
import {
  computeObjectsWorldBounds,
  frameTargetObjectIds,
  frameViewportCamera,
  resetViewportCamera,
} from '../../lib/viewport/viewportCamera.js';

/**
 * Publishes the live R3F camera + canvas size for DOM-level tools (marquee, etc.)
 * and applies viewport center / reset requests from the editor store.
 * @param {{ slotId: string, viewId: import('./viewportConfig.js').ViewportId }} props
 */
export function ViewportCameraBridge({ slotId, viewId }) {
  const { camera, size, gl } = useThree();
  const controls = useThree((s) => s.controls);
  const registerViewportHandle = useEditorStore((s) => s.registerViewportHandle);
  const unregisterViewportHandle = useEditorStore((s) => s.unregisterViewportHandle);
  const viewportCameraRequest = useEditorStore((s) => s.viewportCameraRequest);
  const lastRequestIdRef = useRef(-1);

  useLayoutEffect(() => {
    registerViewportHandle(slotId, {
      camera,
      width: size.width,
      height: size.height,
      canvas: gl.domElement,
    });
    return () => unregisterViewportHandle(slotId);
  }, [slotId, camera, size.width, size.height, gl.domElement, registerViewportHandle, unregisterViewportHandle]);

  useEffect(() => {
    const request = viewportCameraRequest;
    if (!request || !request.slotIds.includes(slotId)) return;
    if (request.id === lastRequestIdRef.current) return;
    lastRequestIdRef.current = request.id;

    const state = useEditorStore.getState();
    if (request.action === 'reset') {
      resetViewportCamera(camera, controls, viewId);
      return;
    }

    const objectIds = frameTargetObjectIds(state, request.scope ?? 'selection');
    const bounds = computeObjectsWorldBounds(state.objects, objectIds);
    frameViewportCamera(camera, controls, bounds, viewId, {
      width: size.width,
      height: size.height,
    });
  }, [viewportCameraRequest, slotId, viewId, camera, controls, size.width, size.height]);

  return null;
}
