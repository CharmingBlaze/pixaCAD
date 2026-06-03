import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { ORTHO_VIEW_SETUP } from './orthoViewSetup.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';

const L = 24;

/**
 * Crisp 2D-style ortho grid (minor / major / origin lines).
 * @param {{ orthoView: import('./orthoViewSetup.js').OrthoViewId, cellSize?: number }} props
 */
export function OrthoGrid2D({ orthoView, cellSize = 1 }) {
  const vp = useViewportTheme();
  const { gridRotation } = ORTHO_VIEW_SETUP[orthoView];
  const step = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 1;

  const geometry = useMemo(() => {
    const positions = [];
    const colors = [];
    const minor = new THREE.Color(vp.gridCell);
    const major = new THREE.Color(vp.gridSection);
    const origin = new THREE.Color(vp.gridOrigin);
    const half = 48;

    for (let i = -half; i <= half; i++) {
      const coord = i * step;
      const isMajor = i % 4 === 0;
      const isOrigin = i === 0;
      const c = isOrigin ? origin : isMajor ? major : minor;
      const extent = half * step;
      positions.push(-extent, 0, coord, extent, 0, coord);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
      positions.push(coord, 0, -extent, coord, 0, extent);
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [step, vp.gridCell, vp.gridSection, vp.gridOrigin]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group rotation={gridRotation} position={[0, 0.002, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.92} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
