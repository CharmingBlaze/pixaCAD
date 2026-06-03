import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '../store/editorStore.js';
import {
  meshPivotToClientPixels,
  advanceRotateAngleFromPointer,
  viewRotationAxisWorld,
  worldPivotToClientPixels,
} from '../lib/mesh/subObjectTransform.js';
import {
  computeObjectsWorldExtent,
  computeVertexSelectionWorldExtent,
  scaleFactorFromPointer,
  scaleWheelMultiplierStep,
  worldAxisFromLock,
  worldAxisScreenDirection,
} from '../lib/viewport/blenderScaleInput.js';

/** Ignore tiny pointer jitter between applied samples. */
const MIN_POINTER_STEP_PX = 2;
/** Distinguish a confirm click from a drag gesture. */
const CLICK_MOVE_THRESHOLD_PX = 4;

/**
 * Blender-style interactive scale / rotate (Shift+S / Shift+R).
 * Uses the active viewport's camera so rotation matches the view you're working in.
 */
export function useInteractiveSubTransform() {
  const interactiveTransformActive = useEditorStore((s) => s.interactiveTransformActive);
  const interactiveTransformMode = useEditorStore((s) => s.interactiveTransformMode);
  const updateInteractiveTransform = useEditorStore((s) => s.updateInteractiveTransform);
  const confirmInteractiveTransform = useEditorStore((s) => s.confirmInteractiveTransform);

  const lastPointerRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    lastApplyX: 0,
    lastApplyY: 0,
    ready: false,
    pivotScreenX: null,
    pivotScreenY: null,
    /** @type {[number, number, number] | null} */
    axisWorld: null,
    pointerAngleRad: null,
    accumulatedAngleRad: 0,
    wheelMultiplier: 1,
    worldExtent: 1,
    /** @type {{ x: number, y: number, magnitude: number } | null} */
    axisScreenDir: null,
    /** @type {THREE.Vector3 | null} */
    worldAnchor: null,
  });
  const clickRef = useRef(
    /** @type {null | { x: number, y: number, pointerId: number }} */ (null),
  );

  useEffect(() => {
    const trackPointer = (e) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('pointermove', trackPointer);
    return () => window.removeEventListener('pointermove', trackPointer);
  }, []);

  useEffect(() => {
    if (!interactiveTransformActive || !interactiveTransformMode) return undefined;

    const startPointer = lastPointerRef.current;
    dragRef.current = {
      startX: startPointer.x,
      startY: startPointer.y,
      lastApplyX: startPointer.x,
      lastApplyY: startPointer.y,
      ready: true,
      pivotScreenX: null,
      pivotScreenY: null,
      axisWorld: null,
      pointerAngleRad: null,
      accumulatedAngleRad: 0,
      wheelMultiplier: 1,
      worldExtent: 1,
      axisScreenDir: null,
      worldAnchor: null,
    };
    clickRef.current = null;

    let rafId = 0;
    /** @type {PointerEvent | null} */
    let pendingEvent = null;

    const getActiveViewport = () => {
      const state = useEditorStore.getState();
      const handle = state.viewportHandles[state.activeViewportSlot];
      if (!handle?.camera || !handle.canvas) return null;
      return handle;
    };

    const refreshScaleContext = (state, viewport) => {
      const ref = dragRef.current;

      if (!ref.worldAnchor) {
        const objectSession = state.objectInteractiveSession;
        const meshSession = state.vertexManipSession;

        if (objectSession) {
          ref.worldExtent = computeObjectsWorldExtent(state.objects, objectSession.objectIds);
          ref.worldAnchor = new THREE.Vector3(
            objectSession.pivotWorld[0],
            objectSession.pivotWorld[1],
            objectSession.pivotWorld[2],
          );
        } else if (meshSession) {
          const obj = state.objects.find((o) => o.id === meshSession.objectId);
          ref.worldExtent = obj
            ? computeVertexSelectionWorldExtent(obj, state.objects, meshSession.vertexIndices)
            : 1;
          const pw = meshSession.startPivotWorld ?? meshSession.startCentroidLocal;
          ref.worldAnchor = new THREE.Vector3(pw[0], pw[1], pw[2]);
        } else {
          ref.worldExtent = 1;
          ref.worldAnchor = new THREE.Vector3();
        }
      }

      const lock = state.gizmoAxisLock;
      if (lock && ref.worldAnchor) {
        const rect = viewport.canvas.getBoundingClientRect();
        ref.axisScreenDir = worldAxisScreenDirection(
          worldAxisFromLock(lock),
          ref.worldAnchor,
          viewport.camera,
          { width: rect.width, height: rect.height },
        );
      } else {
        ref.axisScreenDir = null;
      }
    };

    const applyScale = (e, state, pivot, viewport) => {
      const ref = dragRef.current;
      refreshScaleContext(state, viewport);

      const screenDir =
        state.gizmoAxisLock && ref.axisScreenDir?.magnitude >= 2 ? ref.axisScreenDir : null;

      updateInteractiveTransform({
        scaleFactor: scaleFactorFromPointer({
          pivotX: pivot.x,
          pivotY: pivot.y,
          startX: ref.startX,
          startY: ref.startY,
          clientX: e.clientX,
          clientY: e.clientY,
          screenDir,
          shiftKey: e.shiftKey,
          wheelMultiplier: ref.wheelMultiplier,
        }),
      });
    };

    const applyFromPointer = (e, { force = false } = {}) => {
      const viewport = getActiveViewport();
      if (!viewport) return;

      const ref = dragRef.current;
      const state = useEditorStore.getState();
      const mode = state.interactiveTransformMode;
      if (!mode) return;

      const isRotate = mode === 'rotate';
      if (
        !isRotate &&
        !force &&
        Math.hypot(e.clientX - ref.lastApplyX, e.clientY - ref.lastApplyY) < MIN_POINTER_STEP_PX
      ) {
        return;
      }
      ref.lastApplyX = e.clientX;
      ref.lastApplyY = e.clientY;

      const objectSession = state.objectInteractiveSession;
      const meshSession = state.vertexManipSession;
      const object = state.objects.find((o) => o.id === state.selectedId);
      const cam = viewport.camera;
      const dom = viewport.canvas;

      let pivot;
      if (objectSession) {
        pivot = worldPivotToClientPixels(objectSession.pivotWorld, cam, dom);
      } else if (object && meshSession) {
        pivot = meshPivotToClientPixels(meshSession.startCentroidLocal, object, cam, dom, state.objects);
      } else {
        return;
      }

      if (isRotate) {
        if (ref.pivotScreenX === null || ref.pivotScreenY === null) {
          ref.pivotScreenX = pivot.x;
          ref.pivotScreenY = pivot.y;
          ref.axisWorld = viewRotationAxisWorld(cam);
        }

        const { pointerAngle, accumulatedAngle } = advanceRotateAngleFromPointer(
          ref.pivotScreenX,
          ref.pivotScreenY,
          e.clientX,
          e.clientY,
          ref.pointerAngleRad,
          ref.accumulatedAngleRad,
        );
        ref.pointerAngleRad = pointerAngle;
        ref.accumulatedAngleRad = accumulatedAngle;

        updateInteractiveTransform({ angleRad: accumulatedAngle, axisWorld: ref.axisWorld });
        return;
      }

      if (mode === 'scale') {
        applyScale(e, state, pivot, viewport);
      }
    };

    const onMove = (e) => {
      pendingEvent = e;
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const event = pendingEvent;
        pendingEvent = null;
        if (event) applyFromPointer(event);
      });
    };

    const onWheel = (e) => {
      if (useEditorStore.getState().interactiveTransformMode !== 'scale') return;
      e.preventDefault();
      const ref = dragRef.current;
      const sign = e.deltaY < 0 ? 1 : -1;
      const step = scaleWheelMultiplierStep(ref.worldExtent, e.shiftKey);
      ref.wheelMultiplier *= sign > 0 ? step : 1 / step;

      const viewport = getActiveViewport();
      if (!viewport) return;
      const event = pendingEvent ?? { clientX: ref.lastApplyX, clientY: ref.lastApplyY, shiftKey: e.shiftKey };
      applyFromPointer(event, { force: true });
    };

    const onDown = (e) => {
      if (e.button !== 0) return;
      clickRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    };

    const onUp = (e) => {
      if (e.button !== 0 || !clickRef.current) return;
      if (e.pointerId !== clickRef.current.pointerId) return;

      const click = clickRef.current;
      clickRef.current = null;
      const moved = Math.hypot(e.clientX - click.x, e.clientY - click.y);
      if (moved > CLICK_MOVE_THRESHOLD_PX) return;

      e.preventDefault();
      e.stopPropagation();
      if (pendingEvent) applyFromPointer(pendingEvent, { force: true });
      else applyFromPointer(e, { force: true });
      confirmInteractiveTransform();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown, { capture: true });
    window.addEventListener('pointerup', onUp, { capture: true });
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      window.removeEventListener('pointerup', onUp, { capture: true });
      window.removeEventListener('wheel', onWheel, { capture: true });
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [
    interactiveTransformActive,
    interactiveTransformMode,
    updateInteractiveTransform,
    confirmInteractiveTransform,
  ]);
}
