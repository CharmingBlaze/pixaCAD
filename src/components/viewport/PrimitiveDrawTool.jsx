import { useEffect, useRef, useCallback } from 'react';

import * as THREE from 'three';

import { useThree } from '@react-three/fiber';

import { useEditorStore } from '../../store/editorStore.js';

import { DRAW_PLANE_ROTATION } from './drawPlaneConfig.js';

import { intersectDrawPlane } from '../../lib/draw/cadDraw.js';



const HEIGHT_PIXEL_SCALE = 0.025;

const WHEEL_HEIGHT_SCALE = 0.01;

/** Anchor for first width click before drawStart exists. */

const PLANE_ORIGIN = [0, 0, 0];



/**

 * CAD primitive draw — state machine: idle → width → height.

 * Width: canvas capture on draw host. Height: window listeners on draw host.

 */

export function PrimitiveDrawTool({ viewId, orthoView }) {

  const { gl, camera } = useThree();

  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);

  const drawPhase = useEditorStore((s) => s.drawPhase);

  const drawViewId = useEditorStore((s) => s.drawViewId);

  const setActiveViewport = useEditorStore((s) => s.setActiveViewport);

  const beginWidthDrag = useEditorStore((s) => s.beginWidthDrag);

  const updateWidthDrag = useEditorStore((s) => s.updateWidthDrag);

  const endWidthDrag = useEditorStore((s) => s.endWidthDrag);

  const setDrawHeight = useEditorStore((s) => s.setDrawHeight);

  const adjustDrawHeight = useEditorStore((s) => s.adjustDrawHeight);

  const finalizeDraw = useEditorStore((s) => s.finalizeDraw);



  const heightAnchorRef = useRef({ startY: 0, startH: 1 });

  const activePointerIdRef = useRef(/** @type {number | null} */ (null));



  const planeKey = orthoView ?? 'perspective';

  const rotation = DRAW_PLANE_ROTATION[planeKey];

  const isDrawHost = drawViewId === viewId;

  const showDrawPlane = !!pendingPrimitive || isDrawHost;

  const syncHeightAnchor = useCallback((clientY) => {

    const { drawHeight } = useEditorStore.getState();

    heightAnchorRef.current = { startY: clientY, startH: drawHeight };

  }, []);



  const resolvePoint = useCallback(

    (clientX, clientY, anchor) =>

      intersectDrawPlane(clientX, clientY, viewId, anchor, camera, gl.domElement),

    [viewId, camera, gl],

  );



  const applyHeightFromPointer = useCallback(

    (clientY) => {

      const { startY, startH } = heightAnchorRef.current;

      setDrawHeight(startH + (startY - clientY) * HEIGHT_PIXEL_SCALE);

    },

    [setDrawHeight],

  );



  /** Idle: any viewport with pending primitive can start a draw. */

  useEffect(() => {

    if (!pendingPrimitive || drawPhase !== 'idle') return;



    const el = gl.domElement;



    const onPointerDown = (e) => {

      if (e.button !== 0) return;

      if (useEditorStore.getState().drawPhase !== 'idle') return;



      const p = resolvePoint(e.clientX, e.clientY, PLANE_ORIGIN);

      if (!p) return;



      e.preventDefault();

      e.stopPropagation();



      activePointerIdRef.current = e.pointerId;

      el.setPointerCapture(e.pointerId);

      setActiveViewport(viewId);

      beginWidthDrag(p, viewId);

    };



    el.addEventListener('pointerdown', onPointerDown, { capture: true });

    return () => el.removeEventListener('pointerdown', onPointerDown, { capture: true });

  }, [pendingPrimitive, drawPhase, viewId, gl, resolvePoint, setActiveViewport, beginWidthDrag]);



  /** Width drag on draw host only. */

  useEffect(() => {

    if (!isDrawHost || drawPhase !== 'width') return;



    const el = gl.domElement;



    const releaseCapture = (pointerId) => {

      if (activePointerIdRef.current !== pointerId) return;

      try {

        el.releasePointerCapture(pointerId);

      } catch {

        /* already released */

      }

      activePointerIdRef.current = null;

    };



    const onPointerMove = (e) => {

      if (useEditorStore.getState().drawPhase !== 'width') return;

      if ((e.buttons & 1) !== 1) return;

      const start = useEditorStore.getState().drawStart;

      if (!start) return;

      const p = resolvePoint(e.clientX, e.clientY, start);

      if (p) updateWidthDrag(p);

    };



    const onPointerUp = (e) => {

      if (e.button !== 0) return;

      if (useEditorStore.getState().drawPhase !== 'width') return;

      if (useEditorStore.getState().drawViewId !== viewId) return;

      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;



      endWidthDrag();

      syncHeightAnchor(e.clientY);

      releaseCapture(e.pointerId);

    };



    window.addEventListener('pointermove', onPointerMove);

    window.addEventListener('pointerup', onPointerUp);

    window.addEventListener('pointercancel', onPointerUp);



    return () => {

      window.removeEventListener('pointermove', onPointerMove);

      window.removeEventListener('pointerup', onPointerUp);

      window.removeEventListener('pointercancel', onPointerUp);

      if (activePointerIdRef.current !== null) {

        releaseCapture(activePointerIdRef.current);

      }

    };

  }, [isDrawHost, drawPhase, viewId, gl, resolvePoint, updateWidthDrag, endWidthDrag, syncHeightAnchor]);



  /** Height: global move / wheel / click on draw host. */

  useEffect(() => {

    if (!isDrawHost || drawPhase !== 'height') return;



    const el = gl.domElement;



    const onPointerMove = (e) => {

      if (useEditorStore.getState().drawPhase !== 'height') return;

      if (useEditorStore.getState().drawViewId !== viewId) return;

      applyHeightFromPointer(e.clientY);

    };



    const onPointerDown = (e) => {

      if (e.button !== 0) return;

      if (useEditorStore.getState().drawPhase !== 'height') return;

      if (useEditorStore.getState().drawViewId !== viewId) return;



      e.preventDefault();

      e.stopPropagation();

      finalizeDraw();

    };



    const onWheel = (e) => {

      if (useEditorStore.getState().drawPhase !== 'height') return;

      if (useEditorStore.getState().drawViewId !== viewId) return;

      e.preventDefault();

      e.stopPropagation();

      adjustDrawHeight(-e.deltaY * WHEEL_HEIGHT_SCALE);

      heightAnchorRef.current.startH = useEditorStore.getState().drawHeight;

    };



    window.addEventListener('pointermove', onPointerMove);

    window.addEventListener('pointerdown', onPointerDown, { capture: true });

    window.addEventListener('wheel', onWheel, { passive: false, capture: true });

    el.addEventListener('wheel', onWheel, { passive: false, capture: true });



    return () => {

      window.removeEventListener('pointermove', onPointerMove);

      window.removeEventListener('pointerdown', onPointerDown, { capture: true });

      window.removeEventListener('wheel', onWheel, { capture: true });

      el.removeEventListener('wheel', onWheel, { capture: true });

    };

  }, [

    isDrawHost,

    drawPhase,

    viewId,

    gl,

    applyHeightFromPointer,

    adjustDrawHeight,

    finalizeDraw,

  ]);



  /** Re-anchor height when entering height phase (e.g. store transition without pointerup). */

  useEffect(() => {

    if (isDrawHost && drawPhase === 'height') {

      heightAnchorRef.current.startH = useEditorStore.getState().drawHeight;

    }

  }, [isDrawHost, drawPhase]);



  if (!pendingPrimitive) return null;

  return (
    <>
      {showDrawPlane && (

        <mesh rotation={rotation} renderOrder={20}>

          <planeGeometry args={[200, 200]} />

          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />

        </mesh>

      )}

    </>

  );

}

