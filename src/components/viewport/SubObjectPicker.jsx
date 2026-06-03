import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore.js';
import { isInteractionBlocked } from '../../store/interaction.js';
import { selectModeFromEvent } from '../../store/selection.js';
import { localToWorld, worldRayToMeshLocal, worldToLocal } from '../../lib/mesh/transform.js';
import { parseEdgeKey } from '../../lib/mesh/edgeKeys.js';
import { pickEdge, pickFace, hitMeshSurface } from '../../lib/mesh/pick.js';
import { intersectViewPlane } from '../../lib/mesh/viewDragPlane.js';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _worldRay = new THREE.Ray();
const DRAG_THRESHOLD_PX = 6;

/**
 * Viewport-wide ray picking for sub-objects (perspective + ortho, screen-space verts/edges).
 */
export function SubObjectPicker({ object, viewId }) {
  const { camera, gl, size } = useThree();
  const editMode = useEditorStore((s) => s.editMode);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectEdge = useEditorStore((s) => s.selectEdge);
  const selectFace = useEditorStore((s) => s.selectFace);
  const beginVertexManip = useEditorStore((s) => s.beginVertexManip);
  const applyVertexManipDelta = useEditorStore((s) => s.applyVertexManipDelta);
  const endVertexManip = useEditorStore((s) => s.endVertexManip);
  const setHoveredFace = useEditorStore((s) => s.setHoveredFace);
  const setHoveredEdge = useEditorStore((s) => s.setHoveredEdge);
  const clearSubSelection = useEditorStore((s) => s.clearSubSelection);
  const mesh = object.mesh;

  const objectRef = useRef(object);
  objectRef.current = object;

  const pointerRef = useRef({ x: 0, y: 0, ndcX: 0, ndcY: 0 });
  const dragRef = useRef(null);

  const rayFromClient = (clientX, clientY) => {
    const dom = gl.domElement;
    const rect = dom.getBoundingClientRect();
    pointerRef.current.x = clientX;
    pointerRef.current.y = clientY;
    pointerRef.current.ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    _ndc.set(pointerRef.current.ndcX, pointerRef.current.ndcY);
    _raycaster.setFromCamera(_ndc, camera);
    _worldRay.copy(_raycaster.ray);
    return worldRayToMeshLocal(_raycaster.ray, objectRef.current);
  };

  const pickOpts = () => ({
    camera,
    pointerNdc: _ndc,
    viewportSize: { width: size.width, height: size.height },
    thresholdPx: 14,
  });

  const rayThresholds = () => {
    const s = objectRef.current.scale;
    const maxScale = Math.max(s[0], s[1], s[2], 0.001);
    return { edge: 0.1 / maxScale };
  };

  useEffect(() => {
    if (selectedId !== object.id || editMode === 'object' || editMode === 'vertex' || !mesh) {
      return undefined;
    }

    const dom = gl.domElement;
    let downX = 0;
    let downY = 0;
    let downPending = false;

    const clearHover = () => {
      setHoveredFace(null);
      setHoveredEdge(null);
    };

    const onPointerMove = (e) => {
      const st = useEditorStore.getState();
      if (st.marqueeActive) {
        dragRef.current = null;
        downPending = false;
        return;
      }

      const session = st.vertexManipSession;
      const drag = dragRef.current;
      if (drag?.planeDragStarted && session?.kind === 'plane' && session.sourceViewId === viewId) {
        rayFromClient(e.clientX, e.clientY);
        const hitWorld = intersectViewPlane(_worldRay, drag.anchorWorld, camera);
        if (!hitWorld) return;
        const hitLocal = worldToLocal([hitWorld.x, hitWorld.y, hitWorld.z], objectRef.current);
        const c = session.startCentroidLocal;
        applyVertexManipDelta([hitLocal[0] - c[0], hitLocal[1] - c[1], hitLocal[2] - c[2]]);
        return;
      }

      if (isInteractionBlocked(st) || st.editMode === 'vertex') {
        clearHover();
        return;
      }

      const ray = rayFromClient(e.clientX, e.clientY);
      if (drag?.pointerId === e.pointerId && !drag.planeDragStarted) {
        const dx = e.clientX - drag.downX;
        const dy = e.clientY - drag.downY;
        // Face mode: click to select only — use gizmo (G / Shift+S / Shift+R) or tools to transform.
        if (drag.type !== 'face' && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          startPlaneDrag(e);
        }
        return;
      }

      const opts = { ...pickOpts(), object: objectRef.current };
      const { edge } = rayThresholds();

      if (st.editMode === 'face') {
        const fi = pickFace(mesh, ray);
        if (fi !== st.hoveredFace) setHoveredFace(fi >= 0 ? fi : null);
        return;
      }

      if (st.editMode === 'edge') {
        const key = pickEdge(mesh, ray, { ...opts, maxDist: edge, thresholdPx: 14 });
        if (key !== st.hoveredEdge) setHoveredEdge(key);
      }
    };

    const onPointerLeave = () => clearHover();

    const performPick = (e) => {
      const st = useEditorStore.getState();
      if (isInteractionBlocked(st) || st.editMode === 'vertex') {
        return false;
      }
      if (e.button !== 0) return false;

      const mode = selectModeFromEvent(e);
      const ray = rayFromClient(e.clientX, e.clientY);
      const opts = { ...pickOpts(), object: objectRef.current };
      const { edge } = rayThresholds();
      const onMesh = hitMeshSurface(mesh, ray);

      if (st.editMode === 'edge') {
        const key = pickEdge(mesh, ray, { ...opts, maxDist: edge, thresholdPx: 14 });
        if (key) {
          e.preventDefault();
          e.stopPropagation();
          selectEdge(key, mode);
          return true;
        }
        if (mode === 'replace' && !onMesh) clearSubSelection();
        return false;
      }

      if (st.editMode === 'face') {
        const fi = pickFace(mesh, ray);
        if (fi >= 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();
          selectFace(fi, mode);
          return true;
        }
        if (mode === 'replace' && !onMesh) clearSubSelection();
      }

      return false;
    };

    const onPointerDown = (e) => {
      const st = useEditorStore.getState();
      if (isInteractionBlocked(st) || st.editMode === 'vertex') return;
      if (e.button !== 0) return;
      downX = e.clientX;
      downY = e.clientY;
      downPending = true;
      const ray = rayFromClient(e.clientX, e.clientY);
      const mode = selectModeFromEvent(e);
      const opts = { ...pickOpts(), object: objectRef.current };
      const { edge } = rayThresholds();
      const picked =
        st.editMode === 'edge'
          ? pickEdge(mesh, ray, { ...opts, maxDist: edge, thresholdPx: 14 })
          : pickFace(mesh, ray);
      if (picked !== null && picked !== undefined && picked !== -1) {
        dragRef.current = {
          pointerId: e.pointerId,
          downX: e.clientX,
          downY: e.clientY,
          type: st.editMode,
          item: picked,
          mode,
          anchorWorld: new THREE.Vector3(),
          planeDragStarted: false,
        };
        if (st.editMode === 'face') {
          e.preventDefault();
        } else {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const startPlaneDrag = (e) => {
      const drag = dragRef.current;
      if (!drag || drag.planeDragStarted) return;
      const st = useEditorStore.getState();
      if (st.editMode !== drag.type || !objectRef.current.mesh) return;

      let vertices = [];
      if (drag.type === 'edge') {
        if (!st.selectedEdges.includes(drag.item)) {
          selectEdge(drag.item, drag.mode);
        }
        vertices = useEditorStore.getState().selectedEdges.flatMap((key) => parseEdgeKey(key));
      } else if (drag.type === 'face') {
        return;
      }
      vertices = [...new Set(vertices)].filter((vi) => vi >= 0 && vi < objectRef.current.mesh.vertexCount);
      if (vertices.length === 0) return;

      beginVertexManip({
        objectId: objectRef.current.id,
        vertexIndices: vertices,
        kind: 'plane',
        sourceViewId: viewId,
      });
      const session = useEditorStore.getState().vertexManipSession;
      if (!session) return;
      drag.planeDragStarted = true;
      drag.anchorWorld = new THREE.Vector3(...localToWorld(session.startCentroidLocal, objectRef.current));
      try {
        dom.setPointerCapture(e.pointerId);
      } catch {
        /* pointer may already be captured by the canvas host */
      }
    };

    const onPointerUp = (e) => {
      const activeSession = useEditorStore.getState().vertexManipSession;
      if (activeSession?.kind === 'plane' && activeSession.sourceViewId === viewId) {
        try {
          dom.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        endVertexManip();
        downPending = false;
        dragRef.current = null;
        return;
      }

      if (useEditorStore.getState().marqueeActive) {
        downPending = false;
        dragRef.current = null;
        return;
      }

      if (!downPending) return;
      downPending = false;
      const drag = dragRef.current;
      if (drag?.pointerId === e.pointerId && drag.planeDragStarted) {
        try {
          dom.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        endVertexManip();
        dragRef.current = null;
        return;
      }
      dragRef.current = null;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) return;
      performPick(e);
    };

    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerleave', onPointerLeave);
    dom.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    window.addEventListener('pointercancel', onPointerUp, { capture: true });

    return () => {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', onPointerLeave);
      dom.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
      window.removeEventListener('pointercancel', onPointerUp, { capture: true });
      clearHover();
    };
  }, [
    camera,
    gl,
    size.width,
    size.height,
    editMode,
    selectedId,
    object.id,
    mesh,
    mesh?.positions,
    mesh?.faces,
    selectEdge,
    selectFace,
    beginVertexManip,
    applyVertexManipDelta,
    endVertexManip,
    viewId,
    setHoveredFace,
    setHoveredEdge,
    clearSubSelection,
  ]);

  return null;
}
