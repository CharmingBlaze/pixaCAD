import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useEditorStore } from '../../store/editorStore.js';
import {
  buildBoxFromDraw,
  boxMetrics,
  footprintCorners,
} from '../../lib/draw/cadDraw.js';
import { createPrimitiveForDrawView, scaleForBox } from '../../lib/mesh/primitives.js';

const ACCENT = { perspective: '#fbbf24', ortho: '#6eb5ff' };
const FILL = { perspective: '#fbbf24', ortho: '#4a90d9' };

/**
 * @param {{ viewId: import('./viewportConfig.js').ViewportId }} props
 */
export function DrawBoxPreview({ viewId }) {
  const invalidate = useThree((s) => s.invalidate);
  const drawRevision = useEditorStore((s) => s.drawRevision);
  const drawStart = useEditorStore((s) => s.drawStart);
  const drawCorner2 = useEditorStore((s) => s.drawCorner2);
  const drawHeight = useEditorStore((s) => s.drawHeight);
  const drawViewId = useEditorStore((s) => s.drawViewId);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);
  const paintColor = useEditorStore((s) => s.paintColor);

  const ghostGeometry = useMemo(() => {
    if (!pendingPrimitive || !drawViewId) return null;
    return createPrimitiveForDrawView(pendingPrimitive, drawViewId).toBufferGeometry();
  }, [pendingPrimitive, drawViewId]);

  useEffect(() => {
    invalidate();
  }, [drawRevision, drawPhase, drawHeight, drawCorner2, drawStart, invalidate]);

  if (!pendingPrimitive || !drawStart || !drawCorner2 || !drawViewId || drawPhase === 'idle') {
    return null;
  }

  const footprint = footprintCorners(drawStart, drawCorner2, drawViewId);
  const height = drawPhase === 'width' ? 0.02 : drawHeight;
  const { min, max } = buildBoxFromDraw(drawStart, drawCorner2, height, drawViewId);
  const metrics = boxMetrics(min, max);

  const accent = viewId === 'perspective' ? ACCENT.perspective : ACCENT.ortho;
  const fill = viewId === 'perspective' ? FILL.perspective : FILL.ortho;
  const isWidth = drawPhase === 'width';
  const { center, size } = metrics;
  const meshScale = scaleForBox(pendingPrimitive, size, drawViewId);
  const sizeKey = size.map((v) => v.toFixed(4)).join(',');
  const footprintKey = footprint.map((p) => p.join(',')).join('|');

  const footprintLoop = footprint.map((p) => new THREE.Vector3(...p));
  footprintLoop.push(footprintLoop[0].clone());

  return (
    <group key={`draw-${drawRevision}`}>
      <Line
        key={`footprint-${footprintKey}`}
        points={footprintLoop}
        color={accent}
        lineWidth={2}
        transparent
        opacity={0.95}
      />
      {footprint.map((p, i) => (
        <mesh key={`corner-${i}-${p.join(',')}`} position={p}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={i === 0 ? '#fff' : accent} />
        </mesh>
      ))}

      <group position={center}>
        <mesh key={`box-${sizeKey}`}>
          <boxGeometry args={size} />
          <meshBasicMaterial
            color={fill}
            transparent
            opacity={isWidth ? 0.08 : 0.14}
            depthWrite={false}
          />
        </mesh>
        <lineSegments key={`edges-${sizeKey}`}>
          <edgesGeometry args={[new THREE.BoxGeometry(...size)]} />
          <lineBasicMaterial color={accent} transparent opacity={0.9} />
        </lineSegments>
        {!isWidth && ghostGeometry && (
          <mesh key={`ghost-${sizeKey}`} geometry={ghostGeometry} scale={meshScale}>
            <meshBasicMaterial color={paintColor} transparent opacity={0.4} depthWrite={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

