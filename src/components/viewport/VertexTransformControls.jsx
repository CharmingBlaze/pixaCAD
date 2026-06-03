import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ThemedTransformControls } from './ThemedTransformControls.jsx';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore.js';
import { vertexCentroid } from '../../lib/mesh/vertexManip.js';

const _world = new THREE.Vector3();
const _local = new THREE.Vector3();
const _lockedLocal = new THREE.Vector3();
const _startMatrix = new THREE.Matrix4();
const _currentMatrix = new THREE.Matrix4();
const _deltaMatrix = new THREE.Matrix4();
const _invStartMatrix = new THREE.Matrix4();
const _objectWorldInverse = new THREE.Matrix4();
const _identityQuat = new THREE.Quaternion();
const _unitScale = new THREE.Vector3(1, 1, 1);
const _worldQuat = new THREE.Quaternion();
const _worldScale = new THREE.Vector3();
const _gizmoPos = new THREE.Vector3();
const _gizmoQuat = new THREE.Quaternion();
const _gizmoScl = new THREE.Vector3();
const _gizmoAxis = new THREE.Vector3();
const AXIS_LOCK_EPSILON = 1e-5;
/** Dampen gizmo ring rotation so small drags do not spin too fast. */
const GIZMO_ROTATE_SENSITIVITY = 0.35;

function dominantAxisFromDelta(delta, allowedAxis = null) {
  const allowed = typeof allowedAxis === 'string' && allowedAxis.length > 0 ? allowedAxis : 'XYZ';
  const x = allowed.includes('X') ? Math.abs(delta.x) : -1;
  const y = allowed.includes('Y') ? Math.abs(delta.y) : -1;
  const z = allowed.includes('Z') ? Math.abs(delta.z) : -1;
  const max = Math.max(x, y, z);
  if (max <= AXIS_LOCK_EPSILON) return allowed.length === 1 ? allowed : null;
  if (x >= y && x >= z) return 'X';
  return y >= z ? 'Y' : 'Z';
}

/**
 * Sub-object transform gizmo — moves, rotates, and scales selected mesh vertices.
 * @param {{ objectId: string, mesh: import('../../lib/mesh/EditableMesh.js').EditableMesh, objectGroupRef: React.RefObject<THREE.Group | null>, moveVertexIndices: number[] }} props
 */
export function VertexTransformControls({ objectId, mesh, objectGroupRef, moveVertexIndices }) {
  const pivotRef = useRef(/** @type {THREE.Object3D | null} */ (null));
  const controlsRef = useRef(/** @type {import('three-stdlib').TransformControls | null} */ (null));
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const vertexManipActive = useEditorStore((s) => s.vertexManipActive);
  const vertexManipSession = useEditorStore((s) => s.vertexManipSession);
  const transformMode = useEditorStore((s) => s.transformMode);
  const beginVertexManip = useEditorStore((s) => s.beginVertexManip);
  const applyVertexManipDelta = useEditorStore((s) => s.applyVertexManipDelta);
  const applyVertexManipPositions = useEditorStore((s) => s.applyVertexManipPositions);
  const endVertexManip = useEditorStore((s) => s.endVertexManip);

  const isGizmoDragging = useRef(false);
  const dragPivotLocal = useRef(/** @type {THREE.Vector3 | null} */ (null));
  const dragStartPositions = useRef(/** @type {[number, number, number][] | null} */ (null));
  const dragAxisRef = useRef(/** @type {string | null} */ (null));
  const [controlsReady, setControlsReady] = useState(false);
  const [pivotReady, setPivotReady] = useState(false);
  const [gizmoDragging, setGizmoDragging] = useState(false);

  const vertexKey = moveVertexIndices.join(',');

  const localCentroid = useMemo(() => {
    const c = vertexCentroid(mesh, moveVertexIndices);
    return new THREE.Vector3(...c);
  }, [mesh, meshRevision, vertexKey]);

  const syncPivotToCentroid = () => {
    const pivot = pivotRef.current;
    const objectGroup = objectGroupRef.current;
    if (!pivot || !objectGroup || isGizmoDragging.current) return;
    if (
      vertexManipActive &&
      (vertexManipSession?.kind === 'plane' || vertexManipSession?.kind === 'interactive')
    ) {
      return;
    }

    objectGroup.updateMatrixWorld(true);
    pivot.position.copy(localCentroid).applyMatrix4(objectGroup.matrixWorld);
    objectGroup.matrixWorld.decompose(_world, _worldQuat, _worldScale);
    pivot.quaternion.copy(_worldQuat);
    pivot.scale.set(1, 1, 1);
    pivot.updateMatrixWorld(true);
  };

  useLayoutEffect(() => {
    syncPivotToCentroid();
  }, [localCentroid, transformMode, vertexManipActive, vertexManipSession?.kind, pivotReady]);

  useEffect(() => {
    if (vertexManipSession) return;
    isGizmoDragging.current = false;
    setGizmoDragging(false);
    dragPivotLocal.current = null;
    dragStartPositions.current = null;
    dragAxisRef.current = null;
    syncPivotToCentroid();
  }, [vertexManipSession]);

  const applyGizmoDrag = () => {
    if (!isGizmoDragging.current || !dragPivotLocal.current || !pivotRef.current || !objectGroupRef.current) {
      return;
    }

    if (transformMode === 'translate') {
      pivotRef.current.updateMatrixWorld(true);
      pivotRef.current.getWorldPosition(_world);
      objectGroupRef.current.updateMatrixWorld(true);
      _local.copy(_world);
      objectGroupRef.current.worldToLocal(_local);

      if (!dragAxisRef.current && controlsRef.current?.axis) {
        dragAxisRef.current = controlsRef.current.axis;
      }
      const delta = _local.clone().sub(dragPivotLocal.current);
      const axis = dominantAxisFromDelta(delta, dragAxisRef.current);
      if (!axis) return;
      dragAxisRef.current = axis;
      _lockedLocal.copy(dragPivotLocal.current);
      if (axis === 'X') _lockedLocal.x = _local.x;
      else if (axis === 'Y') _lockedLocal.y = _local.y;
      else if (axis === 'Z') _lockedLocal.z = _local.z;

      _world.copy(_lockedLocal).applyMatrix4(objectGroupRef.current.matrixWorld);
      pivotRef.current.position.copy(_world);
      pivotRef.current.updateMatrixWorld(true);

      applyVertexManipDelta([
        _lockedLocal.x - dragPivotLocal.current.x,
        _lockedLocal.y - dragPivotLocal.current.y,
        _lockedLocal.z - dragPivotLocal.current.z,
      ]);
      return;
    }

    const startPositions = dragStartPositions.current;
    if (!startPositions) return;

    objectGroupRef.current.updateMatrixWorld(true);
    pivotRef.current.updateMatrixWorld(true);
    _startMatrix.compose(dragPivotLocal.current, _identityQuat, _unitScale);
    _objectWorldInverse.copy(objectGroupRef.current.matrixWorld).invert();
    _currentMatrix.multiplyMatrices(_objectWorldInverse, pivotRef.current.matrixWorld);
    _invStartMatrix.copy(_startMatrix).invert();
    _deltaMatrix.multiplyMatrices(_currentMatrix, _invStartMatrix);

    if (transformMode === 'rotate') {
      _deltaMatrix.decompose(_gizmoPos, _gizmoQuat, _gizmoScl);
      const angle = 2 * Math.acos(Math.min(1, Math.abs(_gizmoQuat.w)));
      if (angle > 1e-6) {
        const sinHalf = Math.sin(angle / 2);
        _gizmoAxis.set(_gizmoQuat.x / sinHalf, _gizmoQuat.y / sinHalf, _gizmoQuat.z / sinHalf);
        _gizmoQuat.setFromAxisAngle(_gizmoAxis, angle * GIZMO_ROTATE_SENSITIVITY);
      } else {
        _gizmoQuat.identity();
      }
      _deltaMatrix.compose(_gizmoPos, _gizmoQuat, _gizmoScl);
    }

    const transformed = startPositions.map((p) => {
      _local.set(p[0], p[1], p[2]).applyMatrix4(_deltaMatrix);
      return /** @type {[number, number, number]} */ ([_local.x, _local.y, _local.z]);
    });
    applyVertexManipPositions(transformed);
  };

  useEffect(() => {
    const tc = controlsRef.current;
    if (!tc) return undefined;

    const onDraggingChanged = (event) => {
      const dragging = event.value === true;
      isGizmoDragging.current = dragging;
      setGizmoDragging(dragging);

      if (dragging) {
        if (moveVertexIndices.length === 0) return;

        beginVertexManip({
          objectId,
          vertexIndices: moveVertexIndices,
          kind: 'gizmo',
          sourceViewId: null,
        });

        const session = useEditorStore.getState().vertexManipSession;
        dragAxisRef.current = transformMode === 'translate' ? controlsRef.current?.axis ?? null : null;
        dragPivotLocal.current = session
          ? new THREE.Vector3(...session.startCentroidLocal)
          : localCentroid.clone();
        dragStartPositions.current = session ? session.startPositions.map((p) => [...p]) : null;
        if (pivotRef.current && objectGroupRef.current) {
          objectGroupRef.current.updateMatrixWorld(true);
          pivotRef.current.position.copy(dragPivotLocal.current).applyMatrix4(objectGroupRef.current.matrixWorld);
          objectGroupRef.current.matrixWorld.decompose(_world, _worldQuat, _worldScale);
          pivotRef.current.quaternion.copy(_worldQuat);
          pivotRef.current.scale.set(1, 1, 1);
          pivotRef.current.updateMatrixWorld(true);
        }
      } else {
        dragPivotLocal.current = null;
        dragStartPositions.current = null;
        dragAxisRef.current = null;
        endVertexManip();
        syncPivotToCentroid();
      }
    };

    const onChange = () => applyGizmoDrag();

    tc.addEventListener('dragging-changed', onDraggingChanged);
    tc.addEventListener('objectChange', onChange);
    tc.addEventListener('change', onChange);

    return () => {
      tc.removeEventListener('dragging-changed', onDraggingChanged);
      tc.removeEventListener('objectChange', onChange);
      tc.removeEventListener('change', onChange);
      if (isGizmoDragging.current) {
        endVertexManip();
      }
    };
  }, [
    objectId,
    vertexKey,
    controlsReady,
    pivotReady,
    transformMode,
    beginVertexManip,
    endVertexManip,
    applyVertexManipDelta,
    applyVertexManipPositions,
  ]);

  const gizmoKey = `${objectId}-${vertexKey}-${transformMode}`;
  const planeDragActive = vertexManipActive && vertexManipSession?.kind === 'plane';
  const interactiveDragActive = vertexManipActive && vertexManipSession?.kind === 'interactive';
  const controlsEnabled = gizmoDragging || (!planeDragActive && !interactiveDragActive);

  return (
    <>
      <object3D
        ref={(node) => {
          pivotRef.current = node;
          setPivotReady(!!node);
        }}
      />
      {pivotReady && (
        <ThemedTransformControls
          ref={(node) => {
            controlsRef.current = node;
            setControlsReady(!!node);
          }}
          key={gizmoKey}
          object={pivotRef.current}
          mode={transformMode}
          space="local"
          size={1.0}
          enabled={controlsEnabled}
          onObjectChange={applyGizmoDrag}
        />
      )}
    </>
  );
}
