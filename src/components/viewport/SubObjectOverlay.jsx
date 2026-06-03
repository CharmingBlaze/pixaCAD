import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useEditorStore } from '../../store/editorStore.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { VertexMarkers } from './VertexMarkers.jsx';
import { SubObjectPicker } from './SubObjectPicker.jsx';
import { FaceSelectionOverlay } from './FaceSelectionOverlay.jsx';
import { faceOutlinePoints } from '../../lib/mesh/faceGeometry.js';
import { vertexDepthBucket } from '../../lib/selection/vertexDepth.js';

function edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

export function SubObjectOverlay({ object, viewId }) {
  const editMode = useEditorStore((s) => s.editMode);
  const selectedVertices = useEditorStore((s) => s.selectedVertices);
  const selectedEdges = useEditorStore((s) => s.selectedEdges);
  const hoveredEdge = useEditorStore((s) => s.hoveredEdge);
  const hoveredVertex = useEditorStore((s) => s.hoveredVertex);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const showXRay = useEditorStore((s) => s.showXRay);
  const showWireframe = useEditorStore((s) => s.showWireframe);
  const sel = useViewportTheme().selection;

  const mesh = object.mesh;
  if (!mesh) return null;

  const edges = useMemo(() => mesh.getEdges(), [mesh, meshRevision]);
  const seamSet = useMemo(() => new Set(mesh.uvSeamEdges ?? []), [mesh, meshRevision]);
  const sharpSet = useMemo(() => new Set(mesh.sharpEdges ?? []), [mesh, meshRevision]);
  const vertexDepthBuckets = useMemo(() => {
    const buckets = [];
    for (let i = 0; i < mesh.vertexCount; i++) {
      buckets.push(vertexDepthBucket(object, mesh, i, viewId));
    }
    return buckets;
  }, [object, mesh, meshRevision, viewId]);

  const edgeLines = useMemo(() => {
    return edges.map(([a, b]) => {
      const pa = mesh.getPosition(a);
      const pb = mesh.getPosition(b);
      const key = edgeKey(a, b);
      const active = selectedEdges.includes(key);
      const hover = !active && hoveredEdge === key;
      const isSeam = seamSet.has(key);
      const isSharp = sharpSet.has(key);
      return {
        key,
        points: [new THREE.Vector3(...pa), new THREE.Vector3(...pb)],
        active,
        hover,
        isSeam,
        isSharp,
      };
    });
  }, [edges, mesh, meshRevision, selectedEdges, hoveredEdge, seamSet, sharpSet]);

  const idleEdgeGeometry = useMemo(() => {
    const positions = [];
    for (const { points, active, hover } of edgeLines) {
      if (active || hover) continue;
      positions.push(points[0].x, points[0].y, points[0].z, points[1].x, points[1].y, points[1].z);
    }
    if (positions.length === 0) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [edgeLines]);

  const accentEdgeLines = useMemo(
    () => edgeLines.filter(({ active, hover, isSeam, isSharp }) => active || hover || isSeam || isSharp),
    [edgeLines],
  );

  useEffect(() => {
    return () => {
      idleEdgeGeometry?.dispose();
    };
  }, [idleEdgeGeometry]);

  return (
    <group>
      <SubObjectPicker object={object} viewId={viewId} />

      {editMode === 'vertex' && (
        <VertexMarkers
          mesh={mesh}
          selectedVertices={selectedVertices}
          hoveredVertex={hoveredVertex}
          parentScale={object.scale}
          xray={showXRay}
          defaultColor={sel.vertexIdle}
          selectedColor={sel.vertexSelected}
          hoverColor={sel.hover}
          outlineColor={sel.vertexOutline}
          depthBuckets={vertexDepthBuckets}
        />
      )}

      {editMode === 'edge' && (
        <group renderOrder={998}>
          {idleEdgeGeometry && (
            <lineSegments geometry={idleEdgeGeometry} renderOrder={999}>
              <lineBasicMaterial
                color={sel.edgeIdle}
                transparent
                opacity={0.72}
                depthTest={!showXRay}
              />
            </lineSegments>
          )}
          {accentEdgeLines.map(({ key, points, active, hover, isSeam, isSharp }) => {
            const renderOrder = active ? 1001 : hover ? 1000 : 999;
            const color = active
              ? sel.edgeSelected
              : hover
                ? sel.edgeHover
                : isSeam
                  ? '#e67e22'
                  : isSharp
                    ? '#8b5cf6'
                    : sel.edgeIdle;
            return (
              <Line
                key={key}
                points={points}
                color={color}
                lineWidth={active ? 5 : hover ? 3 : 1.75}
                depthTest={!showXRay}
                transparent
                opacity={active ? 1 : hover ? 0.95 : 0.72}
                renderOrder={renderOrder}
              />
            );
          })}
        </group>
      )}

      {editMode === 'face' && showWireframe && (
        <group renderOrder={998}>
          {mesh.faces.map((_, fi) => {
            const points = faceOutlinePoints(mesh, fi);
            if (points.length < 2) return null;
            return (
              <Line
                key={fi}
                points={points}
                color={sel.edgeIdle}
                lineWidth={1.25}
                transparent
                opacity={0.55}
                depthTest={!showXRay}
                renderOrder={999}
              />
            );
          })}
        </group>
      )}

      {editMode === 'face' && (
        <FaceSelectionOverlay
          mesh={mesh}
          textureFriendly={!!object.textureDataUrl}
          xray={showXRay}
        />
      )}
    </group>
  );
}
