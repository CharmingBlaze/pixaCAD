import { useEditorStore } from '../../store/editorStore.js';
import { getSelectionSummary } from '../../store/selection.js';
import { FaceColorControls } from './FaceColorControls.jsx';
import {
  buildBoxFromDraw,
  boxMetrics,
  formatDrawSize,
} from '../../lib/draw/cadDraw.js';

export function PropertiesPanel() {
  const selected = useEditorStore((s) => s.objects.find((o) => o.id === s.selectedId) ?? null);
  const selectedVertices = useEditorStore((s) => s.selectedVertices);
  const selectedEdges = useEditorStore((s) => s.selectedEdges);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const editMode = useEditorStore((s) => s.editMode);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const deleteSubSelection = useEditorStore((s) => s.deleteSubSelection);
  const splitSelectedEdges = useEditorStore((s) => s.splitSelectedEdges);
  const bevelSelectedEdges = useEditorStore((s) => s.bevelSelectedEdges);
  const selectionSummary = useEditorStore((s) => getSelectionSummary(s));
  const updateObject = useEditorStore((s) => s.updateObject);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const activeTool = useEditorStore((s) => s.activeTool);
  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const drawStart = useEditorStore((s) => s.drawStart);
  const drawCorner2 = useEditorStore((s) => s.drawCorner2);
  const drawHeight = useEditorStore((s) => s.drawHeight);
  const drawViewId = useEditorStore((s) => s.drawViewId);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const extrudeDistance = useEditorStore((s) => s.extrudeDistance);
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const loopCutFactor = useEditorStore((s) => s.loopCutFactor);
  const loopCutCuts = useEditorStore((s) => s.loopCutCuts);
  const bevelActive = useEditorStore((s) => s.bevelActive);
  const bevelAmount = useEditorStore((s) => s.bevelAmount);
  const bevelSegments = useEditorStore((s) => s.bevelSegments);
  const polyDrawActive = useEditorStore((s) => s.polyDrawActive);
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const weldThreshold = useEditorStore((s) => s.weldThreshold);
  const setWeldThreshold = useEditorStore((s) => s.setWeldThreshold);
  const snapToMeshFeatures = useEditorStore((s) => s.snapToMeshFeatures);
  const toggleSnapToMeshFeatures = useEditorStore((s) => s.toggleSnapToMeshFeatures);

  let drawSizeLabel = '';
  if (drawPhase !== 'idle' && drawStart && drawCorner2 && drawViewId) {
    const h = drawPhase === 'width' ? 0.02 : drawHeight;
    const { min, max } = buildBoxFromDraw(drawStart, drawCorner2, h, drawViewId);
    drawSizeLabel = formatDrawSize(boxMetrics(min, max).size);
  }

  return (
    <aside className="propsPanel">
      <h2>Properties</h2>

      {(pendingPrimitive || polyDrawActive || extrudeActive || loopCutActive || bevelActive || knifeActive) && (
        <div className="propBlock">
          <h3>Active tool</h3>
          <p className="panelHint selectionSummary">
            {activeTool}
            {pendingPrimitive && ` · ${pendingPrimitive}`}
            {drawPhase !== 'idle' && ` · ${drawPhase}`}
            {drawSizeLabel && ` · ${drawSizeLabel}`}
            {extrudeActive && ` · distance ${extrudeDistance.toFixed(3)}`}
            {loopCutActive &&
              ` · cut ${loopCutCuts > 1 ? `${loopCutCuts}×` : `${(loopCutFactor * 100).toFixed(0)}%`}`}
            {bevelActive &&
              ` · bevel ${(bevelAmount * 100).toFixed(0)}%${bevelSegments > 1 ? ` · ${bevelSegments} seg` : ''}`}
          </p>
        </div>
      )}

      {!selected ? (
        <p className="panelHint">Select an object or add a primitive from the left panel.</p>
      ) : (
        <>
          <div className="propBlock">
            <label>
              Name
              <input
                type="text"
                value={selected.name}
                disabled={selected.locked}
                onChange={(e) => updateObject(selected.id, { name: e.target.value })}
              />
            </label>
            <div className="propMeta">
              {selected.isGroup ? (
                <span>Group (no mesh)</span>
              ) : (
                <>
                  <span>{selected.mesh?.vertexCount ?? 0} vertices</span>
                  <span>{selected.mesh?.faceCount ?? 0} faces</span>
                </>
              )}
            </div>
          </div>

          <div className="propBlock">
            <h3>Transform</h3>
            {['position', 'rotation', 'scale'].map((field) => (
              <label key={field} className="vecLabel">
                {field}
                <div className="vecRow">
                  {[0, 1, 2].map((axis) => (
                    <input
                      key={axis}
                      type="number"
                      step={0.1}
                      disabled={selected.locked}
                      value={Number(selected[field][axis].toFixed(3))}
                      onChange={(e) => {
                        const next = [...selected[field]];
                        next[axis] = parseFloat(e.target.value) || 0;
                        updateObject(selected.id, { [field]: next });
                      }}
                    />
                  ))}
                </div>
              </label>
            ))}
          </div>

          {editMode === 'face' && !selected.isGroup && (
            <div className="propBlock">
              <h3>Face color</h3>
              <FaceColorControls showPalette={false} showHint />
            </div>
          )}

          <div className="propBlock">
            <h3>Selection</h3>
            <p className="panelHint selectionSummary">{selectionSummary}</p>
            {editMode !== 'object' && !selected.isGroup && (
              <div className="propBtnRow">
                <button type="button" className="toolBtn compact" onClick={deleteSubSelection} disabled={selected.locked}>
                  Delete {editMode === 'vertex' ? 'verts' : editMode === 'edge' ? 'edge faces' : 'faces'}
                </button>
                {editMode === 'edge' && selectedEdges.length > 0 && (
                  <>
                    <button type="button" className="toolBtn compact" onClick={bevelSelectedEdges} disabled={selected.locked}>
                      Bevel edges (B)
                    </button>
                    <button type="button" className="toolBtn compact" onClick={splitSelectedEdges} disabled={selected.locked}>
                      Split edges (J)
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="propBlock">
            <h3>Mesh edit</h3>
            <label>
              Weld threshold
              <input
                type="number"
                min="0.001"
                max="1"
                step="0.01"
                value={weldThreshold}
                onChange={(e) => setWeldThreshold(Number(e.target.value))}
              />
            </label>
            <label className="propCheck">
              <input
                type="checkbox"
                checked={snapToMeshFeatures}
                onChange={() => toggleSnapToMeshFeatures()}
              />
              Snap to vertices/edges
            </label>
          </div>

          <div className="propBlock propBtnRow">
            <button type="button" disabled={!canUndo} onClick={undo}>
              Undo
            </button>
            <button type="button" disabled={!canRedo} onClick={redo}>
              Redo
            </button>
          </div>

          <button type="button" className="dangerBtn" onClick={removeSelected}>
            Delete Object
          </button>
        </>
      )}

    </aside>
  );
}
