import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Lock, Unlock, Trash2 } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore.js';
import { coalesceSelectedIds } from '../../store/objectSelection.js';
import { isInteractionBlocked } from '../../store/interaction.js';
import { isPolyDrawEngaged } from '../../store/toolState.js';
import { buildBoxFromDraw, boxMetrics, formatDrawSize } from '../../lib/draw/cadDraw.js';
import { useViewportMarquee } from '../../hooks/useViewportMarquee.js';
import { SceneContent } from './SceneContent.jsx';
import { SelectionMarqueeOverlay } from './SelectionMarqueeOverlay.jsx';
import { VIEWPORT_CONFIG, VIEWPORT_OPTIONS } from './viewportConfig.js';
import { ORTHO_VIEW_SETUP } from './orthoViewSetup.js';

const EMPTY_REFERENCES = [];

function isPixelPaintActive(state) {
  return !!(
    state.pixelEditorOpen &&
    state.pixelPaintOnModel &&
    (state.pixelTool === 'brush' ||
      state.pixelTool === 'pencil' ||
      state.pixelTool === 'eraser' ||
      state.pixelTool === 'fill')
  );
}

/**
 * @param {{
 *   slotId?: string,
 *   slotClassName?: string,
 *   viewId: import('./viewportConfig.js').ViewportId,
 *   active: boolean,
 *   maximized?: boolean,
 *   onActivate: () => void,
 *   onViewChange?: (viewId: import('./viewportConfig.js').ViewportId) => void,
 * }} props
 */
export function ViewportCell({ slotId = viewId, slotClassName = '', viewId, active, maximized = false, onActivate, onViewChange }) {
  const [cellEl, setCellEl] = useState(/** @type {HTMLDivElement | null} */ (null));
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const dragRef = useRef(
    /** @type {{
     *   id: string,
     *   pointerId: number,
     *   mode: 'move' | 'scale' | 'rotate',
     *   offsetX?: number,
     *   offsetY?: number,
     *   startX?: number,
     *   startY?: number,
     *   startW?: number,
     *   startH?: number,
     *   centerX?: number,
     *   centerY?: number,
     *   startDist?: number,
     *   startAngle?: number,
     *   pointerStartAngle?: number,
     * } | null} */ (null),
  );
  const marqueeBox = useViewportMarquee(slotId, viewId, cellEl);
  const config = VIEWPORT_CONFIG[viewId];
  const editMode = useEditorStore((s) => s.editMode);
  const transformMode = useEditorStore((s) => s.transformMode);
  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);
  const polyDrawEngaged = useEditorStore((s) => isPolyDrawEngaged(s));
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const drawViewId = useEditorStore((s) => s.drawViewId);
  const drawLiveSize = useEditorStore((s) => {
    if (s.drawPhase === 'idle' || !s.drawStart || !s.drawCorner2 || !s.drawViewId) return '';
    void s.drawRevision;
    const h = s.drawPhase === 'width' ? 0.02 : s.drawHeight;
    const { min, max } = buildBoxFromDraw(s.drawStart, s.drawCorner2, h, s.drawViewId);
    return formatDrawSize(boxMetrics(min, max).size);
  });
  const selectObject = useEditorStore((s) => s.selectObject);
  const setActiveViewport = useEditorStore((s) => s.setActiveViewport);
  const setActiveViewportSlot = useEditorStore((s) => s.setActiveViewportSlot);
  const references = useEditorStore((s) => s.referenceImagesByView[viewId] ?? EMPTY_REFERENCES);
  const addReferenceImage = useEditorStore((s) => s.addReferenceImage);
  const updateReferenceImage = useEditorStore((s) => s.updateReferenceImage);
  const removeReferenceImage = useEditorStore((s) => s.removeReferenceImage);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const isOrtho = config.orthoView !== null;
  const orthoSetup = config.orthoView ? ORTHO_VIEW_SETUP[config.orthoView] : null;
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const bevelActive = useEditorStore((s) => s.bevelActive);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const isDrawing =
    !!pendingPrimitive || polyDrawEngaged || extrudeActive || loopCutActive || bevelActive || knifeActive;
  const referenceInteractionEnabled = !isDrawing && editMode === 'object';

  const drawSizeLabel = pendingPrimitive && drawPhase !== 'idle' ? drawLiveSize : '';

  const handlePointerDownCapture = (e) => {
    if (e.button !== 0) return;
    onActivate();
    setActiveViewport(viewId);
    setActiveViewportSlot(slotId);
  };

  const handlePointerMissed = () => {
    requestAnimationFrame(() => {
      const st = useEditorStore.getState();
      if (st.pendingPrimitive || st.gizmoInteracting || isInteractionBlocked(st)) return;
      if (st.vertexManipActive && st.vertexManipSession) return;
      if (st.editMode !== 'object') return;
      if (coalesceSelectedIds(st).length > 0) selectObject(null);
    });
  };

  const readImageFile = async (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.readAsDataURL(file);
    });

  const beginReferenceDrag = (e, refImage) => {
    if (refImage.locked) return;
    const bounds = cellEl?.getBoundingClientRect();
    if (!bounds) return;
    pushHistory();
    dragRef.current = {
      id: refImage.id,
      pointerId: e.pointerId,
      mode: 'move',
      offsetX: e.clientX - bounds.left - refImage.x,
      offsetY: e.clientY - bounds.top - refImage.y,
    };
    e.stopPropagation();
  };

  const beginReferenceScale = (e, refImage) => {
    if (refImage.locked) return;
    const bounds = cellEl?.getBoundingClientRect();
    if (!bounds) return;
    pushHistory();
    const centerX = refImage.x + refImage.width / 2;
    const centerY = refImage.y + refImage.height / 2;
    const px = e.clientX - bounds.left;
    const py = e.clientY - bounds.top;
    dragRef.current = {
      id: refImage.id,
      pointerId: e.pointerId,
      mode: 'scale',
      startX: refImage.x,
      startY: refImage.y,
      startW: refImage.width,
      startH: refImage.height,
      centerX,
      centerY,
      startDist: Math.max(8, Math.hypot(px - centerX, py - centerY)),
    };
    e.stopPropagation();
  };

  const beginReferenceRotate = (e, refImage) => {
    if (refImage.locked) return;
    const bounds = cellEl?.getBoundingClientRect();
    if (!bounds) return;
    pushHistory();
    const centerX = refImage.x + refImage.width / 2;
    const centerY = refImage.y + refImage.height / 2;
    const px = e.clientX - bounds.left;
    const py = e.clientY - bounds.top;
    dragRef.current = {
      id: refImage.id,
      pointerId: e.pointerId,
      mode: 'rotate',
      startAngle: refImage.rotation ?? 0,
      centerX,
      centerY,
      pointerStartAngle: Math.atan2(py - centerY, px - centerX),
    };
    e.stopPropagation();
  };

  const onCellPointerMove = (e) => {
    const drag = dragRef.current;
    const bounds = cellEl?.getBoundingClientRect();
    if (!drag || !bounds) return;
    const img = references.find((r) => r.id === drag.id);
    if (!img) return;
    if (drag.mode === 'move') {
      const nextX = Math.max(0, Math.min(bounds.width - img.width, e.clientX - bounds.left - (drag.offsetX ?? 0)));
      const nextY = Math.max(0, Math.min(bounds.height - img.height, e.clientY - bounds.top - (drag.offsetY ?? 0)));
      updateReferenceImage(viewId, drag.id, { x: nextX, y: nextY }, { skipHistory: true });
      return;
    }
    if (drag.mode === 'scale') {
      const px = e.clientX - bounds.left;
      const py = e.clientY - bounds.top;
      const centerX = drag.centerX ?? img.x + img.width / 2;
      const centerY = drag.centerY ?? img.y + img.height / 2;
      const dist = Math.max(8, Math.hypot(px - centerX, py - centerY));
      const scale = dist / Math.max(8, drag.startDist ?? dist);
      const nextW = Math.max(64, Math.min(bounds.width, Math.round((drag.startW ?? img.width) * scale)));
      const nextH = Math.max(64, Math.min(bounds.height, Math.round((drag.startH ?? img.height) * scale)));
      const nextX = Math.max(0, Math.min(bounds.width - nextW, centerX - nextW / 2));
      const nextY = Math.max(0, Math.min(bounds.height - nextH, centerY - nextH / 2));
      updateReferenceImage(viewId, drag.id, { width: nextW, height: nextH, x: nextX, y: nextY }, { skipHistory: true });
      return;
    }
    if (drag.mode === 'rotate') {
      const px = e.clientX - bounds.left;
      const py = e.clientY - bounds.top;
      const centerX = drag.centerX ?? img.x + img.width / 2;
      const centerY = drag.centerY ?? img.y + img.height / 2;
      const pointerAngle = Math.atan2(py - centerY, px - centerX);
      const delta = pointerAngle - (drag.pointerStartAngle ?? pointerAngle);
      const nextDeg = ((drag.startAngle ?? 0) + (delta * 180) / Math.PI + 540) % 360 - 180;
      updateReferenceImage(viewId, drag.id, { rotation: Math.round(nextDeg * 10) / 10 }, { skipHistory: true });
    }
  };

  const onCellPointerUp = (e) => {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return;
    dragRef.current = null;
  };

  return (
    <div
      ref={setCellEl}
      data-testid={`viewport-cell-${viewId}`}
      className={[
        'viewportCell',
        slotClassName,
        active ? 'active' : '',
        maximized ? 'maximized' : '',
        isDrawing ? 'drawing' : '',
        marqueeBox ? 'marqueeDragging' : '',
        (pendingPrimitive && drawPhase === 'idle') || polyDrawEngaged || knifeActive ? 'drawReady' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMove={onCellPointerMove}
      onPointerUp={onCellPointerUp}
      onPointerCancel={onCellPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      onAuxClick={(e) => e.preventDefault()}
      onDragOver={(e) => {
        e.preventDefault();
        setDropActive(true);
      }}
      onDragLeave={() => setDropActive(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDropActive(false);
        const files = Array.from(e.dataTransfer?.files ?? []);
        const imageFile = files.find((f) => f.type.startsWith('image/'));
        if (!imageFile) return;
        try {
          const dataUrl = await readImageFile(imageFile);
          addReferenceImage(viewId, dataUrl, imageFile.name);
        } catch {
          useEditorStore.getState().setStatus('Failed to add reference image');
        }
      }}
    >
      <div
        className={menuOpen ? 'viewportCellMenu open' : 'viewportCellMenu'}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseLeave={() => setMenuOpen(false)}
      >
        <button
          type="button"
          className="viewportCellLabel"
          title="Change view"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
        >
          {config.label}
        </button>
        <div className="viewportViewDropdown">
          {VIEWPORT_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={option === viewId ? 'active' : ''}
              onClick={(e) => {
                e.stopPropagation();
                onViewChange?.(option);
                setMenuOpen(false);
              }}
            >
              {VIEWPORT_CONFIG[option].label}
            </button>
          ))}
        </div>
      </div>
      <Canvas
        key={`${slotId}-${viewId}`}
        className="viewportCanvas"
        frameloop={drawPhase !== 'idle' ? 'always' : 'demand'}
        orthographic={isOrtho}
        camera={
          isOrtho && orthoSetup
            ? {
                ...config.camera,
                position: orthoSetup.position,
                up: orthoSetup.up,
              }
            : config.camera
        }
        onPointerMissed={(e) => {
          if (pendingPrimitive) return;
          if (e?.nativeEvent?.__khedObjectHit) return;
          handlePointerMissed();
        }}
      >
        <SceneContent
          slotId={slotId}
          viewId={viewId}
          enableGizmos
          showOrientationGizmo={active && viewId === 'perspective'}
          orthoView={config.orthoView}
        />
      </Canvas>
      <div className="viewportOverlayRoot" aria-hidden>
        {marqueeBox && <SelectionMarqueeOverlay box={marqueeBox} />}
      </div>
      <div
        className={referenceInteractionEnabled ? 'referenceImageLayer' : 'referenceImageLayer toolPassThrough'}
      >
        {references.map((refImage) => (
          <div
            key={refImage.id}
            className={refImage.locked ? 'referenceImageItem locked' : 'referenceImageItem'}
            style={{
              left: `${refImage.x}px`,
              top: `${refImage.y}px`,
              width: `${refImage.width}px`,
              height: `${refImage.height}px`,
              opacity: refImage.opacity,
              transform: `rotate(${refImage.rotation ?? 0}deg)`,
            }}
            onPointerDown={(e) => beginReferenceDrag(e, refImage)}
          >
            <img src={refImage.dataUrl} alt={refImage.name} draggable={false} />
            {!refImage.locked && (
              <>
                <button
                  type="button"
                  className="referenceRotateHandle"
                  title="Rotate reference"
                  onPointerDown={(e) => beginReferenceRotate(e, refImage)}
                />
                <button
                  type="button"
                  className="referenceScaleHandle"
                  title="Scale reference"
                  onPointerDown={(e) => beginReferenceScale(e, refImage)}
                />
              </>
            )}
            <div className="referenceImageToolbar">
              <button
                type="button"
                className="iconBtn tiny"
                title={refImage.locked ? 'Unlock reference' : 'Lock reference'}
                onClick={(e) => {
                  e.stopPropagation();
                  updateReferenceImage(viewId, refImage.id, { locked: !refImage.locked });
                }}
              >
                {refImage.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>
              <button
                type="button"
                className="iconBtn tiny"
                title="Remove reference"
                onClick={(e) => {
                  e.stopPropagation();
                  removeReferenceImage(viewId, refImage.id);
                }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>
        ))}
        {dropActive && <div className="referenceDropHint">Drop image to add reference</div>}
      </div>
      {active && !pendingPrimitive && !polyDrawEngaged && !knifeActive && (
        <div className="viewportCellHud">
          <span>{editMode}</span>
          <span>{transformMode}</span>
        </div>
      )}
    </div>
  );
}
