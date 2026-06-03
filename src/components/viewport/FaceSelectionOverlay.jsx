import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useEditorStore } from '../../store/editorStore.js';
import { buildFaceGeometry, faceOutlinePoints } from '../../lib/mesh/faceGeometry.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';

/**
 * @param {{
 *   mesh: import('../../lib/mesh/EditableMesh.js').EditableMesh,
 *   faceIndex: number,
 *   variant: 'selected' | 'hover',
 *   textureFriendly?: boolean,
 *   xray?: boolean,
 * }} props
 */
function FaceOverlay({ mesh, faceIndex, variant, textureFriendly = false, xray = true }) {
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const sel = useViewportTheme().selection;
  const geometry = useMemo(
    () => buildFaceGeometry(mesh, faceIndex),
    [mesh, meshRevision, faceIndex],
  );

  const outlinePoints = useMemo(
    () => faceOutlinePoints(mesh, faceIndex),
    [mesh, meshRevision, faceIndex],
  );

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry || outlinePoints.length < 2) return null;

  const selected = variant === 'selected';
  const fillColor = selected ? sel.faceFill : sel.faceHoverFill;
  const baseFillOpacity = selected ? sel.faceFillOpacity : sel.faceHoverOpacity;
  const fillOpacity = textureFriendly ? 0 : baseFillOpacity;
  const edgeColor = selected ? sel.faceOutline : sel.faceHoverOutline;
  const baseEdgeOpacity = selected ? sel.faceEdgeOpacity : sel.faceHoverEdgeOpacity;
  const edgeOpacity = textureFriendly ? Math.max(0.5, baseEdgeOpacity * 0.85) : baseEdgeOpacity;
  const renderOrder = selected ? 1000 : 999;

  return (
    <group renderOrder={renderOrder}>
      <mesh geometry={geometry} renderOrder={renderOrder}>
        <meshBasicMaterial
          color={fillColor}
          transparent
          opacity={fillOpacity}
          depthTest={!xray}
          depthWrite={false}
          side={THREE.DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
          toneMapped={false}
        />
      </mesh>
      <Line
        points={outlinePoints}
        color={edgeColor}
        lineWidth={selected ? 2.25 : 1.75}
        transparent
        opacity={edgeOpacity}
        depthTest={!xray}
        toneMapped={false}
        renderOrder={renderOrder + 1}
      />
    </group>
  );
}

/**
 * Face selection visuals — soft fill + thin 1px edge highlight (no thick screen lines).
 * @param {{ mesh: import('../../lib/mesh/EditableMesh.js').EditableMesh, textureFriendly?: boolean, xray?: boolean }} props
 */
export function FaceSelectionOverlay({ mesh, textureFriendly = false, xray = true }) {
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const hoveredFace = useEditorStore((s) => s.hoveredFace);

  const showHover =
    hoveredFace !== null &&
    hoveredFace >= 0 &&
    !selectedFaces.includes(hoveredFace);

  return (
    <group>
      {showHover && (
        <FaceOverlay
          mesh={mesh}
          faceIndex={hoveredFace}
          variant="hover"
          textureFriendly={textureFriendly}
          xray={xray}
        />
      )}
      {selectedFaces.map((fi) => (
        <FaceOverlay
          key={fi}
          mesh={mesh}
          faceIndex={fi}
          variant="selected"
          textureFriendly={textureFriendly}
          xray={xray}
        />
      ))}
    </group>
  );
}
