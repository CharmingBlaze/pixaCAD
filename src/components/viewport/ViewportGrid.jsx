import { Grid } from '@react-three/drei';
import { OrthoGrid2D } from './OrthoGrid2D.jsx';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { useEditorStore } from '../../store/editorStore.js';

/**
 * @param {{ orthoView?: import('./orthoViewSetup.js').OrthoViewId | null }} props
 */
export function ViewportGrid({ orthoView = null }) {
  const vp = useViewportTheme();
  const gridSize = useEditorStore((s) => s.gridSize);
  const cellSize = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1;

  if (orthoView) {
    return <OrthoGrid2D orthoView={orthoView} cellSize={cellSize} />;
  }

  return (
    <Grid
      infiniteGrid
      cellSize={cellSize}
      cellThickness={vp.gridCellThickness}
      sectionSize={4}
      sectionThickness={vp.gridSectionThickness}
      fadeDistance={vp.gridFadeDistance}
      fadeStrength={vp.gridFadeStrength}
      cellColor={vp.gridCell}
      sectionColor={vp.gridSection}
    />
  );
}
