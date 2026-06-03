import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ThemedTransformControls } from './ThemedTransformControls.jsx';
import { useEditorStore } from '../../store/editorStore.js';
import { coalesceSelectedIds } from '../../store/objectSelection.js';
import { computeSelectionGeometryPivotWorld } from '../../lib/scene/groupTransform.js';
import {
  applyObjectInteractiveTransform,
  captureObjectInteractiveSession,
  resolveInteractiveObjectIds,
} from '../../lib/scene/objectInteractiveTransform.js';
import { objectSnapGrid, snapVector3Components } from '../../lib/snap/gridSnap.js';

const _currentPos = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _invStartQuat = new THREE.Quaternion();
const _lockedPos = new THREE.Vector3();

function applyTranslateAxisConstraint(pivot, startPos, axis) {
  if (!axis || typeof axis !== 'string' || axis.length === 0) return;

  _lockedPos.copy(pivot.position);
  if (!axis.includes('X')) _lockedPos.x = startPos.x;
  if (!axis.includes('Y')) _lockedPos.y = startPos.y;
  if (!axis.includes('Z')) _lockedPos.z = startPos.z;
  pivot.position.copy(_lockedPos);
}

/**
 * Move / rotate / scale gizmo for one or more selected scene objects (object edit mode).
 * @param {{ enabled?: boolean }} props
 */
export function ObjectSelectionTransformControls({ enabled = true }) {
  const pivotRef = useRef(/** @type {THREE.Object3D | null} */ (null));
  const controlsRef = useRef(/** @type {import('three-stdlib').TransformControls | null} */ (null));
  const sessionRef = useRef(/** @type {ReturnType<typeof captureObjectInteractiveSession> | null} */ (null));
  const dragStartRef = useRef(/** @type {{ position: THREE.Vector3, quaternion: THREE.Quaternion, scale: THREE.Vector3, axis: string | null } | null} */ (null));
  const isDragging = useRef(false);
  const [controlsReady, setControlsReady] = useState(false);

  const objects = useEditorStore((s) => s.objects);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const editMode = useEditorStore((s) => s.editMode);
  const transformMode = useEditorStore((s) => s.transformMode);
  const gizmoAxisLock = useEditorStore((s) => s.gizmoAxisLock);
  const interactiveTransformActive = useEditorStore((s) => s.interactiveTransformActive);
  const updateObject = useEditorStore((s) => s.updateObject);

  const transformableIds = useMemo(() => {
    const ids = coalesceSelectedIds({ objects, selectedId, selectedIds });
    return resolveInteractiveObjectIds(objects, ids);
  }, [objects, selectedId, selectedIds]);

  const pivotWorld = useMemo(() => {
    const members = transformableIds
      .map((id) => objects.find((o) => o.id === id))
      .filter(Boolean);
    if (members.length === 0) return null;
    return computeSelectionGeometryPivotWorld(objects, members);
  }, [objects, transformableIds]);

  const syncPivot = () => {
    const pivot = pivotRef.current;
    if (!pivot || isDragging.current || !pivotWorld) return;
    pivot.position.set(pivotWorld[0], pivotWorld[1], pivotWorld[2]);
    pivot.quaternion.identity();
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);
  };

  useLayoutEffect(() => {
    syncPivot();
  }, [pivotWorld, transformMode, transformableIds.join(',')]);

  useEffect(() => {
    const tc = controlsRef.current;
    if (!tc) return;
    tc.axis = transformMode === 'translate' ? gizmoAxisLock : null;
  }, [transformMode, gizmoAxisLock, controlsReady]);

  const applySessionToStore = (params) => {
    const session = sessionRef.current;
    if (!session) return;
    const state = useEditorStore.getState();
    const nextObjects = applyObjectInteractiveTransform(state.objects, session, params);
    for (const id of session.objectIds) {
      const updated = nextObjects.find((o) => o.id === id);
      if (!updated) continue;
      updateObject(
        id,
        {
          position: updated.position,
          rotation: updated.rotation,
          scale: updated.scale,
        },
        { skipHistory: true },
      );
    }
  };

  const applyGizmoChange = () => {
    const pivot = pivotRef.current;
    const dragStart = dragStartRef.current;
    const session = sessionRef.current;
    if (!pivot || !dragStart || !session || !isDragging.current) return;

    const state = useEditorStore.getState();
    const mode = state.transformMode;

    if (mode === 'translate') {
      applyTranslateAxisConstraint(pivot, dragStart.position, dragStart.axis);
      pivot.updateMatrixWorld(true);
      pivot.getWorldPosition(_currentPos);
      let dx = _currentPos.x - dragStart.position.x;
      let dy = _currentPos.y - dragStart.position.y;
      let dz = _currentPos.z - dragStart.position.z;

      const grid = objectSnapGrid(state.snapGrid, state.gridSize);
      if (grid > 0) {
        const snapped = snapVector3Components(
          dragStart.position.x + dx,
          dragStart.position.y + dy,
          dragStart.position.z + dz,
          grid,
        );
        dx = snapped[0] - dragStart.position.x;
        dy = snapped[1] - dragStart.position.y;
        dz = snapped[2] - dragStart.position.z;
        pivot.position.set(snapped[0], snapped[1], snapped[2]);
      }

      applySessionToStore({ mode: 'translate', worldDelta: [dx, dy, dz] });
      return;
    }

    if (mode === 'rotate') {
      _invStartQuat.copy(dragStart.quaternion).invert();
      _deltaQuat.copy(pivot.quaternion).multiply(_invStartQuat);
      applySessionToStore({ mode: 'rotate', deltaQuat: _deltaQuat });
      return;
    }

    if (mode === 'scale') {
      const sx = Math.max(0.001, pivot.scale.x / dragStart.scale.x);
      const sy = Math.max(0.001, pivot.scale.y / dragStart.scale.y);
      const sz = Math.max(0.001, pivot.scale.z / dragStart.scale.z);
      applySessionToStore({ mode: 'scale', scaleFactors: [sx, sy, sz] });
    }
  };

  useEffect(() => {
    const tc = controlsRef.current;
    if (!tc) return undefined;

    const onDraggingChanged = (event) => {
      const dragging = event.value === true;
      isDragging.current = dragging;

      if (dragging) {
        const state = useEditorStore.getState();
        const ids = resolveInteractiveObjectIds(state.objects, coalesceSelectedIds(state));
        if (ids.length === 0) return;

        state.pushHistory();
        sessionRef.current = captureObjectInteractiveSession(state.objects, ids);
        const pivot = pivotRef.current;
        if (!pivot || !sessionRef.current) return;

        syncPivot();
        pivot.updateMatrixWorld(true);
        dragStartRef.current = {
          position: pivot.getWorldPosition(new THREE.Vector3()),
          quaternion: pivot.quaternion.clone(),
          scale: pivot.scale.clone(),
          axis:
            transformMode === 'translate'
              ? state.gizmoAxisLock || controlsRef.current?.axis || null
              : null,
        };
      } else {
        sessionRef.current = null;
        dragStartRef.current = null;
        syncPivot();
      }
    };

    const onChange = () => applyGizmoChange();

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('objectChange', onChange);
    tc.addEventListener('change', onChange);

    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('objectChange', onChange);
      tc.removeEventListener('change', onChange);
      isDragging.current = false;
      sessionRef.current = null;
      dragStartRef.current = null;
    };
  }, [controlsReady, transformMode, transformableIds.join(',')]);

  const visible =
    enabled &&
    editMode === 'object' &&
    !interactiveTransformActive &&
    transformableIds.length > 0 &&
    pivotWorld;

  if (!visible) return null;

  const gizmoKey = `${transformableIds.join(',')}-${transformMode}`;

  return (
    <>
      <object3D ref={pivotRef} />
      <ThemedTransformControls
        ref={(node) => {
          controlsRef.current = node;
          setControlsReady(!!node);
        }}
        key={gizmoKey}
        object={pivotRef}
        mode={transformMode}
        showX={transformMode !== 'translate' || !gizmoAxisLock || gizmoAxisLock === 'X'}
        showY={transformMode !== 'translate' || !gizmoAxisLock || gizmoAxisLock === 'Y'}
        showZ={transformMode !== 'translate' || !gizmoAxisLock || gizmoAxisLock === 'Z'}
        size={1.0}
      />
    </>
  );
}
