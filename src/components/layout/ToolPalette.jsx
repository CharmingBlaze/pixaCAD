import {
  Box,
  Circle,
  Cone,
  Copy,
  Cylinder,
  MousePointer2,
  Move3D,
  RotateCcw,
  Scale3D,
  Square,
  Triangle,
  GitBranch,
  Layers,
  FlipHorizontal,
  PenTool,
  Scissors,
  Eye,
  Magnet,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore.js';
import { isPolyDrawEngaged } from '../../store/toolState.js';

function TorusIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <ellipse cx="12" cy="12" rx="8.5" ry="5.5" stroke="currentColor" strokeWidth="1.8" />
      <ellipse cx="12" cy="12" rx="3.3" ry="2.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CapsuleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="3.5" width="10" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 8.2h10M7 15.8h10" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
    </svg>
  );
}

function OctahedronIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3.5l6 8.5-6 8.5L6 12z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.5V20.5M6 12h12" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
    </svg>
  );
}

function PrismIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 16l5.5-9L18 16z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.2 17.7L13.7 8.7M18 16l-1.8 1.7H8.2L6 16" stroke="currentColor" strokeWidth="1.2" opacity="0.9" />
    </svg>
  );
}

const MODES = [
  { id: 'object', label: 'Object', key: '1', icon: MousePointer2 },
  { id: 'vertex', label: 'Vertex', key: '2', icon: Circle },
  { id: 'edge', label: 'Edge', key: '3', icon: GitBranch },
  { id: 'face', label: 'Face', key: '4', icon: Layers },
];

const TRANSFORMS = [
  { id: 'translate', label: 'Move', key: 'G', icon: Move3D },
  { id: 'rotate', label: 'Rotate', key: 'R', icon: RotateCcw },
  { id: 'scale', label: 'Scale', key: 'S', icon: Scale3D },
];

const PRIMITIVE_ICONS = {
  cube: Box,
  sphere: Circle,
  cylinder: Cylinder,
  cone: Cone,
  pyramid: Triangle,
  plane: Square,
  torus: TorusIcon,
  capsule: CapsuleIcon,
  octahedron: OctahedronIcon,
  prism: PrismIcon,
};

export function ToolPalette() {
  const editMode = useEditorStore((s) => s.editMode);
  const transformMode = useEditorStore((s) => s.transformMode);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const setTransformMode = useEditorStore((s) => s.setTransformMode);
  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);
  const startPrimitiveDraw = useEditorStore((s) => s.startPrimitiveDraw);
  const cancelPrimitiveDraw = useEditorStore((s) => s.cancelPrimitiveDraw);
  const polyDrawEngaged = useEditorStore((s) => isPolyDrawEngaged(s));
  const polyFaceMode = useEditorStore((s) => s.polyFaceMode);
  const startPolyDraw = useEditorStore((s) => s.startPolyDraw);
  const cancelPolyDraw = useEditorStore((s) => s.cancelPolyDraw);
  const setPolyFaceMode = useEditorStore((s) => s.setPolyFaceMode);
  const activeTool = useEditorStore((s) => s.activeTool);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const extrudeSelection = useEditorStore((s) => s.extrudeSelection);
  const subdivideSelection = useEditorStore((s) => s.subdivideSelection);
  const insetSelection = useEditorStore((s) => s.insetSelection);
  const decimateSelection = useEditorStore((s) => s.decimateSelection);
  const toggleUvSeamOnSelection = useEditorStore((s) => s.toggleUvSeamOnSelection);
  const toggleSharpEdgeOnSelection = useEditorStore((s) => s.toggleSharpEdgeOnSelection);
  const mirrorSelection = useEditorStore((s) => s.mirrorSelection);
  const mirrorObjectDuplicate = useEditorStore((s) => s.mirrorObjectDuplicate);
  const flipNormals = useEditorStore((s) => s.flipNormals);
  const splitSelectedEdges = useEditorStore((s) => s.splitSelectedEdges);
  const bevelActive = useEditorStore((s) => s.bevelActive);
  const startBevelSession = useEditorStore((s) => s.startBevelSession);
  const cancelBevelSession = useEditorStore((s) => s.cancelBevelSession);
  const mergeSelection = useEditorStore((s) => s.mergeSelection);
  const selectEdgeLoop = useEditorStore((s) => s.selectEdgeLoop);
  const selectEdgeRing = useEditorStore((s) => s.selectEdgeRing);
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const startLoopCutSession = useEditorStore((s) => s.startLoopCutSession);
  const cancelLoopCutSession = useEditorStore((s) => s.cancelLoopCutSession);
  const snapSelectionToGrid = useEditorStore((s) => s.snapSelectionToGrid);
  const startKnifeTool = useEditorStore((s) => s.startKnifeTool);
  const cancelKnifeTool = useEditorStore((s) => s.cancelKnifeTool);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedVertices = useEditorStore((s) => s.selectedVertices);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const selectedEdges = useEditorStore((s) => s.selectedEdges);
  const showXRay = useEditorStore((s) => s.showXRay);
  const toggleXRay = useEditorStore((s) => s.toggleXRay);

  return (
    <aside className="toolPalette">
      <section className="toolSection toolSectionPolyDraw">
        <h2>Poly Draw</h2>
        <button
          type="button"
          data-testid="tool-poly-draw"
          className={
            polyDrawEngaged
              ? 'toolBtn polyDrawBtn active'
              : 'toolBtn polyDrawBtn'
          }
          title="Toggle poly draw — add faces until you click again or press Esc"
          onClick={() => (polyDrawEngaged ? cancelPolyDraw() : startPolyDraw())}
        >
          <PenTool size={14} />
          <span>Poly Draw</span>
        </button>
        <div className="faceModeToggle" role="group" aria-label="Face type">
          <button
            type="button"
            className={polyFaceMode === 'tri' ? 'faceModeBtn active' : 'faceModeBtn'}
            onClick={() => setPolyFaceMode('tri')}
            title="Triangle faces (3 clicks)"
          >
            Tri
          </button>
          <button
            type="button"
            className={polyFaceMode === 'quad' ? 'faceModeBtn active' : 'faceModeBtn'}
            onClick={() => setPolyFaceMode('quad')}
            title="Quad faces (4 clicks)"
          >
            Quad
          </button>
          <button
            type="button"
            className={polyFaceMode === 'poly' ? 'faceModeBtn active' : 'faceModeBtn'}
            onClick={() => setPolyFaceMode('poly')}
            title="Polygon fill (Enter or click first point)"
          >
            Poly
          </button>
        </div>
      </section>

      <section className="toolSection">
        <h2>Create</h2>
        <div className="primitiveGrid">
          {Object.entries(PRIMITIVE_ICONS).map(([type, Icon]) => (
            <button
              key={type}
              type="button"
              data-testid={`tool-create-${type}`}
              className={pendingPrimitive === type ? 'primBtn active' : 'primBtn'}
              title={`Draw ${type} (box)`}
              onClick={() =>
                pendingPrimitive === type ? cancelPrimitiveDraw() : startPrimitiveDraw(type)
              }
            >
              <Icon size={16} />
              <span>{type}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="toolSection">
        <h2>Edit Mode</h2>
        {MODES.map(({ id, label, key, icon: Icon }) => (
          <button
            key={id}
            type="button"
            data-testid={`tool-edit-${id}`}
            className={editMode === id ? 'toolBtn active' : 'toolBtn'}
            title={`${label} (${key})`}
            onClick={() => setEditMode(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            <kbd>{key}</kbd>
          </button>
        ))}
      </section>

      <section className="toolSection">
        <h2>Transform</h2>
        {TRANSFORMS.map(({ id, label, key, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={transformMode === id ? 'toolBtn active' : 'toolBtn'}
            title={`${label} (${key})`}
            onClick={() => setTransformMode(id)}
          >
            <Icon size={18} />
            <span>{label}</span>
            <kbd>{key}</kbd>
          </button>
        ))}
        <button
          type="button"
          className={showXRay ? 'toolBtn active' : 'toolBtn'}
          title="Toggle X-Ray overlays"
          onClick={toggleXRay}
        >
          <Eye size={18} />
          <span>X-Ray</span>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={!selectedId}
          onClick={snapSelectionToGrid}
          title="Snap selection to grid (Ctrl+Shift+S)"
        >
          <Magnet size={18} />
          <span>Snap Sel</span>
          <kbd>Ctrl+Shift+S</kbd>
        </button>
      </section>

      <section className="toolSection grow">
        <h2>Mesh Tools</h2>
        <button
          type="button"
          className={extrudeActive || activeTool === 'extrude' ? 'toolBtn active' : 'toolBtn'}
          onClick={extrudeSelection}
          disabled={
            !(
              (editMode === 'face' && selectedFaces.length > 0) ||
              (editMode === 'edge' && selectedEdges.length > 0)
            )
          }
          title="E (face or edge mode)"
        >
          <Layers size={18} />
          <span>Extrude</span>
          <kbd>E</kbd>
        </button>
        <button
          type="button"
          className={knifeActive || activeTool === 'knife' ? 'toolBtn active' : 'toolBtn'}
          disabled={!selectedId}
          onClick={() => (knifeActive ? cancelKnifeTool() : startKnifeTool())}
          title="K"
        >
          <Scissors size={18} />
          <span>Knife</span>
          <kbd>K</kbd>
        </button>
        <button type="button" className="toolBtn" disabled={!selectedId} onClick={subdivideSelection}>
          <GitBranch size={18} />
          <span>Subdivide</span>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={editMode !== 'face' || selectedFaces.length === 0}
          onClick={insetSelection}
          title="Inset selected faces (I)"
        >
          <Square size={18} />
          <span>Inset</span>
          <kbd>I</kbd>
        </button>
        <button type="button" className="toolBtn" disabled={!selectedId} onClick={decimateSelection} title="Reduce mesh detail">
          <GitBranch size={18} />
          <span>Decimate</span>
        </button>
        <button
          type="button"
          className={loopCutActive || activeTool === 'loopCut' ? 'toolBtn active' : 'toolBtn'}
          disabled={editMode !== 'edge' || selectedEdges.length === 0}
          onClick={() => (loopCutActive ? cancelLoopCutSession() : startLoopCutSession())}
          title="Loop cut (L) — slide position, scroll for more cuts"
        >
          <Scissors size={18} />
          <span>Loop Cut</span>
          <kbd>L</kbd>
        </button>
        <div className="toolMiniGrid" role="group" aria-label="Mirror tools">
          {['x', 'y', 'z'].map((axis) => (
            <button
              key={`mirror-${axis}`}
              type="button"
              className="toolBtn compact"
              disabled={!selectedId}
              onClick={() => mirrorSelection(axis)}
              title={`Add mirrored geometry on ${axis.toUpperCase()}`}
            >
              <FlipHorizontal size={16} />
              <span>Mirror {axis.toUpperCase()}</span>
            </button>
          ))}
          {['x', 'y', 'z'].map((axis) => (
            <button
              key={`flip-${axis}`}
              type="button"
              className="toolBtn compact"
              disabled={!selectedId}
              onClick={() => mirrorSelection(axis, { mode: 'flip' })}
              title={`Flip selection or mesh on ${axis.toUpperCase()}`}
            >
              <FlipHorizontal size={16} />
              <span>Flip {axis.toUpperCase()}</span>
            </button>
          ))}
          {['x', 'y', 'z'].map((axis) => (
            <button
              key={`object-mirror-${axis}`}
              type="button"
              className="toolBtn compact"
              disabled={!selectedId}
              onClick={() => mirrorObjectDuplicate(axis)}
              title={`Duplicate object mirrored across world ${axis.toUpperCase()}`}
            >
              <Copy size={16} />
              <span>Obj {axis.toUpperCase()}</span>
            </button>
          ))}
        </div>
        <button type="button" className="toolBtn" disabled={!selectedId} onClick={flipNormals}>
          <RotateCcw size={18} />
          <span>Flip Normals</span>
        </button>
        <button
          type="button"
          className={bevelActive || activeTool === 'bevel' ? 'toolBtn active' : 'toolBtn'}
          disabled={editMode !== 'edge' || selectedEdges.length === 0}
          onClick={() => (bevelActive ? cancelBevelSession() : startBevelSession())}
          title="Bevel (B / Ctrl+B) — slide width, scroll segments, click confirm"
        >
          <Square size={18} />
          <span>Bevel</span>
          <kbd>B</kbd>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={editMode !== 'edge' || selectedEdges.length === 0}
          onClick={splitSelectedEdges}
          title="J in edge mode"
        >
          <GitBranch size={18} />
          <span>Split Edge</span>
          <kbd>J</kbd>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={editMode !== 'edge' || selectedEdges.length === 0}
          onClick={toggleUvSeamOnSelection}
          title="Toggle UV seam on selected edges"
        >
          <GitBranch size={18} />
          <span>UV Seam</span>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={editMode !== 'edge' || selectedEdges.length === 0}
          onClick={toggleSharpEdgeOnSelection}
          title="Toggle sharp shading on selected edges"
        >
          <Square size={18} />
          <span>Sharp</span>
        </button>
        <button
          type="button"
          className="toolBtn"
          disabled={
            !(
              (editMode === 'vertex' && selectedVertices.length >= 2) ||
              (editMode === 'edge' && selectedEdges.length > 0) ||
              (editMode === 'face' && selectedFaces.length > 0)
            )
          }
          onClick={mergeSelection}
          title="Merge selected vertices/edges/faces to center (M)"
        >
          <Magnet size={18} />
          <span>Merge</span>
          <kbd>M</kbd>
        </button>
        <div className="toolMiniGrid" role="group" aria-label="Loop tools">
          <button
            type="button"
            className="toolBtn compact"
            disabled={editMode !== 'edge' || selectedEdges.length === 0}
            onClick={selectEdgeLoop}
            title="Select edge loop (Shift+L)"
          >
            <GitBranch size={16} />
            <span>Loop</span>
          </button>
          <button
            type="button"
            className="toolBtn compact"
            disabled={editMode !== 'edge' || selectedEdges.length === 0}
            onClick={selectEdgeRing}
            title="Select edge ring (Alt+R)"
          >
            <GitBranch size={16} />
            <span>Ring</span>
          </button>
        </div>
      </section>
    </aside>
  );
}
