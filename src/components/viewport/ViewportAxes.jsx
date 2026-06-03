import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';

const L = 24;

/**
 * 2D axis crosshair aligned to each ortho view (screen X/Y).
 * @param {{ orthoView: import('./orthoViewSetup.js').OrthoViewId }} props
 */
export function ViewportAxes({ orthoView }) {
  const vp = useViewportTheme();

  const lines = useMemo(() => {
    const w = vp.axisPrimary;
    const c = vp.axisAccent;

    if (orthoView === 'top' || orthoView === 'bottom') {
      return [
        { points: [[-L, 0, 0], [L, 0, 0]], color: w },
        { points: [[0, 0, -L], [0, 0, L]], color: w },
        { points: [[0, 0, 0], [0, 0, -L]], color: c },
      ];
    }
    if (orthoView === 'front' || orthoView === 'back') {
      return [
        { points: [[-L, 0, 0], [L, 0, 0]], color: w },
        { points: [[0, -L, 0], [0, L, 0]], color: w },
        { points: [[0, 0, 0], [0, -L, 0]], color: c },
      ];
    }
    return [
      { points: [[0, 0, -L], [0, 0, L]], color: w },
      { points: [[0, -L, 0], [0, L, 0]], color: w },
      { points: [[0, 0, 0], [0, 0, -L]], color: c },
    ];
  }, [orthoView, vp.axisPrimary, vp.axisAccent]);

  return (
    <group>
      {lines.map((line, i) => (
        <Line key={i} points={line.points} color={line.color} lineWidth={1} />
      ))}
    </group>
  );
}
