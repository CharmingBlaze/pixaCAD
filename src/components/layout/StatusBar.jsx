import { useEditorStore } from '../../store/editorStore.js';
import { getSelectionSummary } from '../../store/selection.js';
import { Focus, RotateCcw } from 'lucide-react';
import {
  buildBoxFromDraw,
  boxMetrics,
  formatDrawSize,
} from '../../lib/draw/cadDraw.js';

function selectDrawLive(s) {
  if (s.drawPhase === 'idle' || !s.drawStart || !s.drawCorner2 || !s.drawViewId) return '';
  const h = s.drawPhase === 'width' ? 0.02 : s.drawHeight;
  const { min, max } = buildBoxFromDraw(s.drawStart, s.drawCorner2, h, s.drawViewId);
  void s.drawRevision;
  return formatDrawSize(boxMetrics(min, max).size);
}

export function StatusBar() {
  const statusMessage = useEditorStore((s) => s.statusMessage);
  const editMode = useEditorStore((s) => s.editMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const showWireframe = useEditorStore((s) => s.showWireframe);
  const showXRay = useEditorStore((s) => s.showXRay);
  const renderMode = useEditorStore((s) => s.renderMode);
  const viewportLayoutMode = useEditorStore((s) => s.viewportLayoutMode);
  const snapGrid = useEditorStore((s) => s.snapGrid);
  const gridSize = useEditorStore((s) => s.gridSize);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const objects = useEditorStore((s) => s.objects);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const drawLive = useEditorStore(selectDrawLive);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const extrudeDistance = useEditorStore((s) => s.extrudeDistance);
  const selectionSummary = useEditorStore((s) => getSelectionSummary(s));
  const toggleWireframe = useEditorStore((s) => s.toggleWireframe);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const centerActiveViewport = useEditorStore((s) => s.centerActiveViewport);
  const resetActiveViewport = useEditorStore((s) => s.resetActiveViewport);
  const resetAllViewports = useEditorStore((s) => s.resetAllViewports);
  const toggleSnapToMeshFeatures = useEditorStore((s) => s.toggleSnapToMeshFeatures);
  const snapToMeshFeatures = useEditorStore((s) => s.snapToMeshFeatures);

  const stats = {
    objectCount: objects.length,
    verts: objects.reduce((n, o) => n + (o.mesh?.vertexCount ?? 0), 0),
    faces: objects.reduce((n, o) => n + (o.mesh?.faceCount ?? 0), 0),
  };

  const primary =
    drawPhase !== 'idle' && drawLive ? `${statusMessage} · ${drawLive}` : statusMessage;

  return (
    <footer className="statusBar">
      <span data-testid="status-primary">{primary}</span>
      <span className="statusSep">|</span>
      <span>
        {editMode} · {selectionSummary} · {stats.objectCount} obj · {stats.verts}v · {stats.faces}f · {renderMode}
      </span>
      <span className="statusRight">
        <button
          type="button"
          className={showWireframe ? 'statusToggle active' : 'statusToggle'}
          onClick={toggleWireframe}
          title="Toggle wireframe overlay (W)"
        >
          Wireframe
        </button>
        <button
          type="button"
          className={snapGrid ? 'statusToggle active' : 'statusToggle'}
          onClick={toggleSnap}
          title="Toggle snap to grid"
        >
          Snap
        </button>
        <button
          type="button"
          className={snapToMeshFeatures ? 'statusToggle active' : 'statusToggle'}
          onClick={toggleSnapToMeshFeatures}
          title="Snap to mesh vertices and edge midpoints"
        >
          V/E Snap
        </button>
        <button
          type="button"
          className="statusToggle"
          onClick={() => centerActiveViewport('selection')}
          title="Center active viewport on selection (or whole scene if nothing selected)"
        >
          <Focus size={12} strokeWidth={2.2} aria-hidden />
          Center
        </button>
        <button
          type="button"
          className="statusToggle"
          onClick={resetActiveViewport}
          title="Reset active viewport camera"
        >
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden />
          Reset View
        </button>
        <button
          type="button"
          className="statusToggle"
          onClick={resetAllViewports}
          title="Reset all viewport cameras"
        >
          Reset All
        </button>
        <label className="statusGridSize" title="Grid size step">
          Grid
          <input
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            value={Number.isFinite(gridSize) ? gridSize : 1}
            onChange={(e) => setGridSize(e.target.value)}
          />
        </label>
        {activeTool !== 'select' ? `${activeTool} · ` : ''}
        {drawPhase !== 'idle' ? `${drawPhase} · ` : ''}
        {extrudeActive ? `extrude ${extrudeDistance.toFixed(2)} · ` : ''}
        {canUndo ? 'Undo ' : ''}
        {canRedo ? 'Redo ' : ''}
        {showWireframe ? 'Wire · ' : ''}
        {showXRay ? 'X-Ray · ' : ''}
        {snapGrid ? `Snap ${gridSize}` : 'Free'} · {viewportLayoutMode}
      </span>
    </footer>
  );
}
