import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '../../../store/editorStore.js';
import { isInteractionBlocked } from '../../../store/interaction.js';
import { selectModeFromEvent } from '../../../store/selection.js';
import { worldRayToMeshLocal, worldToLocal, localToWorld } from '../../../lib/mesh/transform.js';
import { pickVertex, hitMeshSurface } from '../../../lib/mesh/pick.js';
import { intersectViewPlane } from '../../../lib/mesh/viewDragPlane.js';
import { chooseVertexByViewDepth } from '../../../lib/selection/vertexDepth.js';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _worldRay = new THREE.Ray();
const DRAG_THRESHOLD_PX = 6;

/**
 * Unified vertex-mode pointer flow for one viewport: hover, click-select, plane drag.
 *
 * @param {{ viewId: import('../viewportConfig.js').ViewportId }} props
 */
export function VertexModeInteraction({ viewId }) {
  const { camera, gl, size } = useThree();
  const editMode = useEditorStore((s) => s.editMode);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectVertex = useEditorStore((s) => s.selectVertex);
  const clearSubSelection = useEditorStore((s) => s.clearSubSelection);
  const setHoveredVertex = useEditorStore((s) => s.setHoveredVertex);
  const beginVertexManip = useEditorStore((s) => s.beginVertexManip);
  const applyVertexManipDelta = useEditorStore((s) => s.applyVertexManipDelta);
  const endVertexManip = useEditorStore((s) => s.endVertexManip);

  const storeRef = useRef({
    selectVertex,
    clearSubSelection,
    setHoveredVertex,
    beginVertexManip,
    applyVertexManipDelta,
    endVertexManip,
  });
  storeRef.current = {
    selectVertex,
    clearSubSelection,
    setHoveredVertex,
    beginVertexManip,
    applyVertexManipDelta,
    endVertexManip,
  };

  /** @type {React.MutableRefObject<null | {
   *   pointerId: number,
   *   downX: number,
   *   downY: number,
   *   pickedIndex: number,
   *   mode: import('../../../store/selection.js').SelectMode,
   *   anchorWorld: THREE.Vector3,
   *   planeDragStarted: boolean,
   *   emptyClick?: boolean,
   * }>} */
  const pointerRef = useRef(null);

  useEffect(() => {
    if (editMode !== 'vertex' || !selectedId) return undefined;

    const dom = gl.domElement;

    const getContext = () => {
      const st = useEditorStore.getState();
      const obj = st.objects.find((o) => o.id === st.selectedId);
      if (!obj?.mesh) return null;
      return { st, obj, mesh: obj.mesh };
    };

    const rayFromClient = (clientX, clientY, obj) => {
      const rect = dom.getBoundingClientRect();
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      _worldRay.copy(_raycaster.ray);
      const localRay = worldRayToMeshLocal(_raycaster.ray, obj);
      const maxScale = Math.max(obj.scale[0], obj.scale[1], obj.scale[2], 0.001);
      return {
        localRay,
        worldRay: _worldRay,
        maxScale,
        pickOpts: {
          camera,
          pointerNdc: _ndc,
          viewportSize: { width: size.width, height: size.height },
          thresholdPx: 20,
          object: obj,
        },
        rayThreshold: 0.15 / maxScale,
      };
    };

    const pickAt = (clientX, clientY) => {
      const ctx = getContext();
      if (!ctx) return null;
      const ray = rayFromClient(clientX, clientY, ctx.obj);
      const candidates = [];
      let bestDistance = ray.pickOpts.thresholdPx;

      for (let i = 0; i < ctx.mesh.vertexCount; i++) {
        const world = new THREE.Vector3(...localToWorld(ctx.mesh.getPosition(i), ctx.obj));
        const projected = world.project(camera);
        const dx = (projected.x - _ndc.x) * 0.5 * size.width;
        const dy = (projected.y - _ndc.y) * 0.5 * size.height;
        const d = Math.hypot(dx, dy);
        if (d > ray.pickOpts.thresholdPx) continue;
        if (d < bestDistance - 2) {
          bestDistance = d;
          candidates.length = 0;
          candidates.push(i);
        } else if (Math.abs(d - bestDistance) <= 2) {
          candidates.push(i);
        }
      }

      let vi = chooseVertexByViewDepth(candidates, ctx.obj, ctx.mesh, viewId, camera);
      if (vi < 0) vi = pickVertex(ctx.mesh, ray.localRay, ray.rayThreshold);
      return { ...ctx, vi, ray };
    };

    const onPointerMove = (e) => {
      const st = useEditorStore.getState();
      if (st.marqueeActive) {
        pointerRef.current = null;
        return;
      }

      const session = st.vertexManipSession;

      if (session?.kind === 'plane' && session.sourceViewId === viewId) {
        const ctx = getContext();
        const pending = pointerRef.current;
        if (!ctx || !pending?.planeDragStarted) return;

        const ray = rayFromClient(e.clientX, e.clientY, ctx.obj);
        const hitWorld = intersectViewPlane(ray.worldRay, pending.anchorWorld, camera);
        if (!hitWorld) return;

        const hitLocal = worldToLocal([hitWorld.x, hitWorld.y, hitWorld.z], ctx.obj);
        const c = session.startCentroidLocal;
        storeRef.current.applyVertexManipDelta([
          hitLocal[0] - c[0],
          hitLocal[1] - c[1],
          hitLocal[2] - c[2],
        ]);
        return;
      }

      if (
        isInteractionBlocked(st) &&
        !session &&
        st.hoveredVertex !== null
      ) {
        storeRef.current.setHoveredVertex(null);
        return;
      }

      if (pointerRef.current?.pointerId === e.pointerId && !pointerRef.current.planeDragStarted) {
        const dx = e.clientX - pointerRef.current.downX;
        const dy = e.clientY - pointerRef.current.downY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
          startPlaneDrag(e);
        }
        return;
      }

      if (session) return;

      const picked = pickAt(e.clientX, e.clientY);
      const vi = picked?.vi ?? -1;
      if (vi !== st.hoveredVertex) storeRef.current.setHoveredVertex(vi >= 0 ? vi : null);
    };

    const startPlaneDrag = (e) => {
      const pending = pointerRef.current;
      if (!pending || pending.planeDragStarted) return;

      const st = useEditorStore.getState();
      const ctx = getContext();
      if (!ctx || pending.pickedIndex < 0 || pending.emptyClick) return;

      let verts = st.selectedVertices;
      if (!verts.includes(pending.pickedIndex)) {
        storeRef.current.selectVertex(pending.pickedIndex, pending.mode);
        verts = useEditorStore.getState().selectedVertices;
      }
      if (!verts.includes(pending.pickedIndex) || verts.length === 0) return;

      pending.planeDragStarted = true;
      e.preventDefault();

      storeRef.current.beginVertexManip({
        objectId: ctx.obj.id,
        vertexIndices: verts,
        kind: 'plane',
        sourceViewId: viewId,
      });

      const session = useEditorStore.getState().vertexManipSession;
      if (!session) return;

      pending.anchorWorld = new THREE.Vector3(
        ...localToWorld(session.startCentroidLocal, ctx.obj),
      );
      dom.setPointerCapture(e.pointerId);
    };

    const onPointerDown = (e) => {
      const st = useEditorStore.getState();
      if (st.editMode !== 'vertex' || isInteractionBlocked(st)) return;
      if (e.button !== 0) return;

      const picked = pickAt(e.clientX, e.clientY);
      const mode = selectModeFromEvent(e);

      if (!picked || picked.vi < 0) {
        pointerRef.current = {
          pointerId: e.pointerId,
          downX: e.clientX,
          downY: e.clientY,
          pickedIndex: -1,
          mode,
          anchorWorld: new THREE.Vector3(),
          planeDragStarted: false,
          emptyClick: true,
        };
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      pointerRef.current = {
        pointerId: e.pointerId,
        downX: e.clientX,
        downY: e.clientY,
        pickedIndex: picked.vi,
        mode,
        anchorWorld: new THREE.Vector3(),
        planeDragStarted: false,
      };
    };

    const onPointerUp = (e) => {
      const activeSession = useEditorStore.getState().vertexManipSession;
      if (activeSession?.kind === 'plane' && activeSession.sourceViewId === viewId) {
        try {
          dom.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        storeRef.current.endVertexManip();
        pointerRef.current = null;
        return;
      }

      if (useEditorStore.getState().marqueeActive) {
        pointerRef.current = null;
        return;
      }

      const pending = pointerRef.current;
      if (!pending || pending.pointerId !== e.pointerId) return;

      if (pending.planeDragStarted) {
        try {
          dom.releasePointerCapture(e.pointerId);
        } catch {
          /* ok */
        }
        storeRef.current.endVertexManip();
        pointerRef.current = null;
        return;
      }

      const dx = e.clientX - pending.downX;
      const dy = e.clientY - pending.downY;
      if (Math.hypot(dx, dy) <= DRAG_THRESHOLD_PX) {
        if (pending.emptyClick) {
          const picked = pickAt(e.clientX, e.clientY);
          if (picked && picked.vi < 0 && pending.mode === 'replace') {
            const onMesh = hitMeshSurface(picked.mesh, picked.ray.localRay);
            if (!onMesh) storeRef.current.clearSubSelection();
          }
        } else {
          e.preventDefault();
          e.stopPropagation();
          storeRef.current.selectVertex(pending.pickedIndex, pending.mode);
        }
      }

      pointerRef.current = null;
    };

    const onPointerLeave = () => {
      if (!pointerRef.current?.planeDragStarted) {
        storeRef.current.setHoveredVertex(null);
      }
    };

    dom.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('pointerleave', onPointerLeave);

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('pointerleave', onPointerLeave);
      pointerRef.current = null;
      const session = useEditorStore.getState().vertexManipSession;
      if (session?.kind === 'plane' && session.sourceViewId === viewId) {
        storeRef.current.endVertexManip();
      }
      storeRef.current.setHoveredVertex(null);
    };
  }, [editMode, selectedId, viewId, camera, gl, size.width, size.height]);

  return null;
}
