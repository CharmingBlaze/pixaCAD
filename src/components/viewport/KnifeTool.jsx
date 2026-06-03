import { useCallback, useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore.js';
import { localToWorld, worldRayToMeshLocal } from '../../lib/mesh/transform.js';
import {
  hitFacePoint,
  localPointOnFace,
  resolveKnifeFaceIndex,
  snapKnifePointOnFace,
} from '../../lib/mesh/knifePick.js';
import { VertexMarkers } from './VertexMarkers.jsx';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();

export function KnifeTool({ viewId }) {
  const { camera, gl } = useThree();
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const knifeStart = useEditorStore((s) => s.knifeStart);
  const selectedId = useEditorStore((s) => s.selectedId);
  const objects = useEditorStore((s) => s.objects);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const setActiveViewport = useEditorStore((s) => s.setActiveViewport);
  const applyKnifePoint = useEditorStore((s) => s.applyKnifePoint);
  const [hover, setHover] = useState(null);
  const sel = useViewportTheme().selection;

  const target = objects.find((o) => o.id === selectedId);
  const allWorldVerts = useMemo(() => {
    if (!target?.mesh) return [];
    const verts = [];
    for (let i = 0; i < target.mesh.vertexCount; i++) {
      verts.push(localToWorld(target.mesh.getPosition(i), target, objects));
    }
    return verts;
  }, [target, objects, meshRevision]);

  const pickAt = useCallback(
    (clientX, clientY) => {
      if (!target?.mesh) return null;
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const localRay = worldRayToMeshLocal(_raycaster.ray, target, objects);
      const state = useEditorStore.getState();
      const activeFaceIndex = state.knifeStart?.faceIndex ?? null;
      const hit = hitFacePoint(target.mesh, localRay, { preferFaceIndex: activeFaceIndex });
      if (!hit) return null;

      let faceIndex = resolveKnifeFaceIndex(
        target.mesh,
        activeFaceIndex,
        hit.faceIndex,
        hit.localPoint,
      );
      const snap = snapKnifePointOnFace(
        target.mesh,
        faceIndex,
        target,
        objects,
        camera,
        _ndc,
        { width: rect.width, height: rect.height },
        20,
      );
      const localPoint = snap?.localPoint ?? hit.localPoint;
      if (activeFaceIndex != null && localPointOnFace(target.mesh, activeFaceIndex, localPoint)) {
        faceIndex = activeFaceIndex;
      }

      return {
        objectId: target.id,
        faceIndex,
        localPoint,
        rawLocalPoint: hit.localPoint,
        vertexIndex: snap?.vertexIndex ?? null,
        worldPoint: localToWorld(localPoint, target, objects),
      };
    },
    [camera, gl, target, objects],
  );

  useEffect(() => {
    if (!knifeActive) {
      setHover(null);
      return undefined;
    }

    const el = gl.domElement;

    const onPointerMove = (e) => {
      if (!useEditorStore.getState().knifeActive) return;
      setHover(pickAt(e.clientX, e.clientY));
    };

    const onPointerDown = (e) => {
      if (e.button !== 0 || !useEditorStore.getState().knifeActive) return;
      const hit = pickAt(e.clientX, e.clientY);
      if (!hit) {
        useEditorStore.getState().setStatus('Knife: click directly on a face');
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      setActiveViewport(viewId);
      applyKnifePoint(
        hit.objectId,
        hit.faceIndex,
        hit.localPoint,
        hit.vertexIndex ?? null,
        hit.rawLocalPoint ?? hit.localPoint,
      );
      setHover(hit);
    };

    const onPointerLeave = () => setHover(null);

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointerleave', onPointerLeave);
      setHover(null);
    };
  }, [knifeActive, gl, pickAt, viewId, setActiveViewport, applyKnifePoint]);

  const knifePreview = useMemo(() => {
    if (!knifeActive || !knifeStart || !target?.mesh) return null;
    if (knifeStart.objectId !== target.id) return null;
    const startWorld = localToWorld(knifeStart.localPoint, target, objects);
    const endWorld =
      hover && hover.objectId === target.id ? hover.worldPoint : startWorld;
    const valid =
      !!hover &&
      hover.objectId === target.id &&
      (hover.faceIndex === knifeStart.faceIndex ||
        localPointOnFace(target.mesh, knifeStart.faceIndex, hover.localPoint));
    return {
      points: [new THREE.Vector3(...startWorld), new THREE.Vector3(...endWorld)],
      valid,
    };
  }, [knifeActive, knifeStart, hover, target, objects, meshRevision]);

  const selectedKnifeVerts = useMemo(() => {
    if (!knifeStart?.objectId || knifeStart.objectId !== target?.id) return [];
    return Number.isInteger(knifeStart.vertexIndex) ? [knifeStart.vertexIndex] : [];
  }, [knifeStart, target]);

  const hoveredKnifeVert =
    hover?.objectId === target?.id && Number.isInteger(hover?.vertexIndex)
      ? hover.vertexIndex
      : null;

  if (!knifeActive) return null;

  return (
    <>
      {allWorldVerts.length > 0 && (
        <VertexMarkers
          points={allWorldVerts}
          selectedVertices={selectedKnifeVerts}
          hoveredVertex={hoveredKnifeVert}
          defaultColor={sel.edgeIdle}
          selectedColor={sel.knifeValid}
          hoverColor={sel.hover}
          cubeSize={0.04}
          hoverCubeSize={0.062}
          selectedCubeSize={0.068}
          xray
        />
      )}
      {knifePreview && (
        <Line
          points={knifePreview.points}
          color={knifePreview.valid ? sel.knifeValid : sel.knifeInvalid}
          lineWidth={3}
          depthTest={false}
          renderOrder={2001}
        />
      )}
      {hover && (
        <mesh position={hover.worldPoint} renderOrder={2002}>
          <boxGeometry args={[0.055, 0.055, 0.055]} />
          <meshBasicMaterial color={sel.knifeValid} depthTest={false} />
        </mesh>
      )}
    </>
  );
}
