import { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';
import { intersectDrawPlane } from '../../lib/draw/cadDraw.js';
import { localToWorld, worldRayToMeshLocal } from '../../lib/mesh/transform.js';
import { pickVertex } from '../../lib/mesh/pick.js';
import { VertexMarkers } from './VertexMarkers.jsx';
import { DRAW_PLANE_ROTATION } from './drawPlaneConfig.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { chooseVertexByViewDepth, vertexDepthBucket } from '../../lib/selection/vertexDepth.js';

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _hit = new THREE.Vector3();
const _bestHit = new THREE.Vector3();
/** Anchor for plane raycast before the first placed vertex sets polyDrawAnchor. */
const PLANE_ORIGIN = [0, 0, 0];

/**
 * Click vertices on the draw plane; tri/quad faces form automatically.
 * Uses canvas capture listeners (like primitive draw) so scene meshes/grid
 * cannot steal pointer hits from the invisible draw plane.
 * @param {{ viewId: import('./viewportConfig.js').ViewportId, orthoView: 'top' | 'front' | 'right' | null }} props
 */
export function PolyDrawTool({ viewId, orthoView = null }) {
  const { camera, gl, size } = useThree();
  const polyDrawActive = useEditorStore((s) => s.polyDrawActive);
  const setActiveViewport = useEditorStore((s) => s.setActiveViewport);
  const polyDrawVerts = useEditorStore((s) => s.polyDrawVerts);
  const polyDrawTargetId = useEditorStore((s) => s.polyDrawTargetId);
  const polyFaceMode = useEditorStore((s) => s.polyFaceMode);
  const objects = useEditorStore((s) => s.objects);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const addPolyDrawPoint = useEditorStore((s) => s.addPolyDrawPoint);
  const addPolyDrawVertex = useEditorStore((s) => s.addPolyDrawVertex);
  const fillPolyDrawFace = useEditorStore((s) => s.fillPolyDrawFace);
  const [hoverVertex, setHoverVertex] = useState(null);
  const sel = useViewportTheme().selection;

  const target = objects.find((o) => o.id === polyDrawTargetId);
  const needed = polyFaceMode === 'tri' ? 3 : polyFaceMode === 'quad' ? 4 : null;
  const planeKey = orthoView ?? 'perspective';
  const rotation = DRAW_PLANE_ROTATION[planeKey];

  const allWorldVerts = useMemo(() => {
    if (!target?.mesh) return [];
    const verts = [];
    for (let i = 0; i < target.mesh.vertexCount; i++) {
      verts.push(localToWorld(target.mesh.getPosition(i), target));
    }
    return verts;
  }, [target, target?.mesh, meshRevision]);

  const vertexDepthBuckets = useMemo(() => {
    if (!target?.mesh) return null;
    const buckets = [];
    for (let i = 0; i < target.mesh.vertexCount; i++) {
      buckets.push(vertexDepthBucket(target, target.mesh, i, viewId, camera));
    }
    return buckets;
  }, [target, target?.mesh, meshRevision, viewId, camera]);

  const currentWorldVerts = useMemo(() => {
    if (!target) return [];
    if (!target.mesh) return [];
    return polyDrawVerts.map((vi) => localToWorld(target.mesh.getPosition(vi), target));
  }, [target, polyDrawVerts, target?.mesh, meshRevision]);

  const linePoints = useMemo(() => {
    const previewVerts = [...currentWorldVerts];
    if (
      hoverVertex !== null &&
      target?.mesh &&
      !polyDrawVerts.includes(hoverVertex) &&
      currentWorldVerts.length > 0 &&
      (!needed || currentWorldVerts.length < needed)
    ) {
      previewVerts.push(localToWorld(target.mesh.getPosition(hoverVertex), target));
    }
    if (previewVerts.length < 2) return null;
    const pts = previewVerts.map((p) => new THREE.Vector3(...p));
    if ((needed && pts.length >= needed) || (!needed && pts.length >= 3)) {
      pts.push(pts[0].clone());
    }
    return pts;
  }, [currentWorldVerts, hoverVertex, target, polyDrawVerts, needed]);

  const faceGeometry = useMemo(() => {
    const minPoints = needed ?? 3;
    if (currentWorldVerts.length < minPoints) return null;
    const verts = needed ? currentWorldVerts.slice(0, needed) : currentWorldVerts;
    const geom = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 1; i < verts.length - 1; i++) {
      positions.push(...verts[0], ...verts[i], ...verts[i + 1]);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geom;
  }, [currentWorldVerts, needed]);

  useEffect(() => {
    return () => {
      faceGeometry?.dispose();
    };
  }, [faceGeometry]);

  const pickExistingVertexAt = useCallback(
    (clientX, clientY) => {
      if (!target?.mesh) return -1;
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return -1;
      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const localRay = worldRayToMeshLocal(_raycaster.ray, target);
      const candidates = [];
      let bestDistance = 18;
      for (let i = 0; i < target.mesh.vertexCount; i++) {
        const world = new THREE.Vector3(...localToWorld(target.mesh.getPosition(i), target));
        const projected = world.project(camera);
        const dx = (projected.x - _ndc.x) * 0.5 * size.width;
        const dy = (projected.y - _ndc.y) * 0.5 * size.height;
        const d = Math.hypot(dx, dy);
        if (d > 18) continue;
        if (d < bestDistance - 2) {
          bestDistance = d;
          candidates.length = 0;
          candidates.push(i);
        } else if (Math.abs(d - bestDistance) <= 2) {
          candidates.push(i);
        }
      }
      const depthPick = chooseVertexByViewDepth(candidates, target, target.mesh, viewId, camera);
      if (depthPick >= 0) return depthPick;
      return pickVertex(target.mesh, localRay, {
        camera,
        pointerNdc: _ndc,
        viewportSize: { width: size.width, height: size.height },
        thresholdPx: 18,
        object: target,
      });
    },
    [target, camera, gl, size.width, size.height, viewId],
  );

  const surfacePointAt = useCallback(
    (clientX, clientY) => {
      if (viewId !== 'perspective' || !target?.mesh || target.mesh.faceCount === 0) return null;
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.setFromCamera(_ndc, camera);
      const localRay = worldRayToMeshLocal(_raycaster.ray, target);

      let bestFace = -1;
      let bestDist = Infinity;
      const v0 = new THREE.Vector3();
      const v1 = new THREE.Vector3();
      const v2 = new THREE.Vector3();

      for (let fi = 0; fi < target.mesh.faces.length; fi++) {
        const face = target.mesh.faces[fi];
        for (let i = 1; i < face.length - 1; i++) {
          v0.fromArray(target.mesh.positions, face[0] * 3);
          v1.fromArray(target.mesh.positions, face[i] * 3);
          v2.fromArray(target.mesh.positions, face[i + 1] * 3);
          const point = localRay.intersectTriangle(v0, v1, v2, false, _hit);
          if (!point) continue;
          const dist = localRay.origin.distanceToSquared(point);
          if (dist < bestDist) {
            bestDist = dist;
            bestFace = fi;
            _bestHit.copy(point);
          }
        }
      }

      if (bestFace < 0) return null;
      return localToWorld([_bestHit.x, _bestHit.y, _bestHit.z], target);
    },
    [viewId, target, camera, gl],
  );

  const resolveDrawPoint = useCallback(
    (clientX, clientY) => {
      const anchor = useEditorStore.getState().polyDrawAnchor ?? PLANE_ORIGIN;
      return intersectDrawPlane(clientX, clientY, viewId, anchor, camera, gl.domElement);
    },
    [viewId, camera, gl],
  );

  const handleClientPick = useCallback(
    (clientX, clientY, opts = {}) => {
      setActiveViewport(viewId);

      const vi = pickExistingVertexAt(clientX, clientY);
      if (vi >= 0) {
        addPolyDrawVertex(vi);
        setHoverVertex(null);
        return true;
      }

      const surfacePoint = surfacePointAt(clientX, clientY);
      if (surfacePoint) {
        addPolyDrawPoint(surfacePoint, viewId, { keepWorldPoint: true });
        return true;
      }

      const p = resolveDrawPoint(clientX, clientY);
      if (!p) {
        useEditorStore.getState().setStatus('Poly draw could not find the draw plane in this view');
        return false;
      }

      addPolyDrawPoint(p, viewId);
      return true;
    },
    [
      viewId,
      pickExistingVertexAt,
      surfacePointAt,
      resolveDrawPoint,
      setActiveViewport,
      addPolyDrawPoint,
      addPolyDrawVertex,
      polyDrawVerts.length,
    ],
  );

  useEffect(() => {
    if (!polyDrawActive) return;

    const el = gl.domElement;

    const onPointerMove = (e) => {
      if (!useEditorStore.getState().polyDrawActive) return;
      const vi = pickExistingVertexAt(e.clientX, e.clientY);
      setHoverVertex(vi >= 0 ? vi : null);
    };

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      if (!useEditorStore.getState().polyDrawActive) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      if (polyFaceMode === 'poly' && polyDrawVerts.length >= 3 && e.detail >= 2) {
        fillPolyDrawFace();
        setHoverVertex(null);
        return;
      }
      handleClientPick(e.clientX, e.clientY, { preferDrawOnSurface: e.shiftKey });
      if (!useEditorStore.getState().polyDrawActive) setHoverVertex(null);
    };

    const onPointerLeave = () => setHoverVertex(null);

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [
    polyDrawActive,
    viewId,
    gl,
    pickExistingVertexAt,
    resolveDrawPoint,
    setActiveViewport,
    handleClientPick,
    fillPolyDrawFace,
    polyDrawVerts.length,
    polyFaceMode,
  ]);

  if (!polyDrawActive) return null;

  return (
    <>
      {allWorldVerts.length > 0 && (
        <VertexMarkers
          points={allWorldVerts}
          selectedVertices={polyDrawVerts}
          hoveredVertex={hoverVertex}
          defaultColor={sel.edgeIdle}
          selectedColor={sel.knifeValid}
          hoverColor={sel.hover}
          cubeSize={0.045}
          hoverCubeSize={0.07}
          selectedCubeSize={0.075}
          depthBuckets={vertexDepthBuckets}
        />
      )}

      {linePoints && (
        <Line points={linePoints} color={sel.edgeIdle} lineWidth={2} depthTest={false} />
      )}

      {faceGeometry && (
        <mesh geometry={faceGeometry} renderOrder={10}>
          <meshBasicMaterial color={sel.faceFill} transparent opacity={0.22} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      )}

      <mesh
        rotation={rotation}
        renderOrder={2000}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          handleClientPick(e.nativeEvent.clientX, e.nativeEvent.clientY, {
            preferDrawOnSurface: e.shiftKey,
          });
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
