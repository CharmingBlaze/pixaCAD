import { useEffect, useRef, useState } from 'react';
import { ViewportCell } from './ViewportCell.jsx';
import { QUAD_LAYOUT } from './viewportConfig.js';
import { useEditorStore } from '../../store/editorStore.js';
import { useInteractiveSubTransform } from '../../hooks/useInteractiveSubTransform.js';

const SLOT_IDS = ['a', 'b', 'c', 'd'];

export function Viewport() {
  const activeView = useEditorStore((s) => s.activeViewport);
  const setActiveViewport = useEditorStore((s) => s.setActiveViewport);
  const setActiveViewportSlot = useEditorStore((s) => s.setActiveViewportSlot);
  const viewportLayoutMode = useEditorStore((s) => s.viewportLayoutMode);
  useInteractiveSubTransform();
  const [slots, setSlots] = useState(() => QUAD_LAYOUT.flat());
  const [split, setSplit] = useState({ col: 50, row: 50 });
  const [maxSlot, setMaxSlot] = useState(null);
  const [activeSlot, setActiveSlot] = useState(0);
  const rootRef = useRef(null);

  const setSlotView = (slotIndex, viewId) => {
    setSlots((prev) => prev.map((v, i) => (i === slotIndex ? viewId : v)));
    setActiveViewport(viewId);
    setActiveSlot(slotIndex);
    setActiveViewportSlot(SLOT_IDS[slotIndex]);
  };

  const beginDrag = (axis) => (e) => {
    e.preventDefault();
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    const onMove = (moveEvent) => {
      if (axis === 'col') {
        const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
        setSplit((s) => ({ ...s, col: Math.max(18, Math.min(82, pct)) }));
      } else {
        const pct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
        setSplit((s) => ({ ...s, row: Math.max(18, Math.min(82, pct)) }));
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.code !== 'Space') return;
      e.preventDefault();
      setMaxSlot((current) => (current === null ? activeSlot : null));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeSlot]);

  const activateSlot = (slotIndex) => {
    setActiveSlot(slotIndex);
    setActiveViewport(slots[slotIndex]);
    setActiveViewportSlot(SLOT_IDS[slotIndex]);
  };

  const effectiveMaxSlot = maxSlot === null && viewportLayoutMode !== 'single' ? null : activeSlot;
  const visibleSlots = (() => {
    if (effectiveMaxSlot !== null) return slots.map((view, i) => (i === effectiveMaxSlot ? view : null));
    if (viewportLayoutMode === 'splitVertical') return [slots[0], null, slots[2], null];
    if (viewportLayoutMode === 'splitHorizontal') return [slots[0], slots[1], null, null];
    return slots;
  })();
  const gridStyle = (() => {
    if (effectiveMaxSlot !== null) {
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
    }
    if (viewportLayoutMode === 'splitVertical') {
      return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 2px 1fr' };
    }
    if (viewportLayoutMode === 'splitHorizontal') {
      return { gridTemplateColumns: '1fr 2px 1fr', gridTemplateRows: '1fr' };
    }
    return {
      gridTemplateColumns: `${split.col}% 2px calc(${100 - split.col}% - 2px)`,
      gridTemplateRows: `${split.row}% 2px calc(${100 - split.row}% - 2px)`,
    };
  })();
  const isQuad = viewportLayoutMode === 'quad' && effectiveMaxSlot === null;
  const isSplitVertical = viewportLayoutMode === 'splitVertical' && effectiveMaxSlot === null;
  const isSplitHorizontal = viewportLayoutMode === 'splitHorizontal' && effectiveMaxSlot === null;

  return (
    <div
      ref={rootRef}
      className={[
        'quadView',
        effectiveMaxSlot === null ? '' : 'maximized',
        isSplitVertical ? 'layoutSplitVertical' : '',
        isSplitHorizontal ? 'layoutSplitHorizontal' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={gridStyle}
    >
      {visibleSlots[0] && (
        <ViewportCell
          slotId={SLOT_IDS[0]}
          slotClassName="slotA"
          viewId={visibleSlots[0]}
          active={activeView === visibleSlots[0] && activeSlot === 0}
          maximized={maxSlot === 0}
          onActivate={() => activateSlot(0)}
          onViewChange={(viewId) => setSlotView(0, viewId)}
        />
      )}
      {isQuad && <div className="viewportSplitter vertical top" onPointerDown={beginDrag('col')} />}
      {isSplitHorizontal && <div className="viewportSplitter vertical top" onPointerDown={beginDrag('col')} />}
      {visibleSlots[1] && (
        <ViewportCell
          slotId={SLOT_IDS[1]}
          slotClassName="slotB"
          viewId={visibleSlots[1]}
          active={activeView === visibleSlots[1] && activeSlot === 1}
          maximized={maxSlot === 1}
          onActivate={() => activateSlot(1)}
          onViewChange={(viewId) => setSlotView(1, viewId)}
        />
      )}
      {isQuad && <div className="viewportSplitter horizontal" onPointerDown={beginDrag('row')} />}
      {isSplitVertical && <div className="viewportSplitter horizontal" onPointerDown={beginDrag('row')} />}
      {visibleSlots[2] && (
        <ViewportCell
          slotId={SLOT_IDS[2]}
          slotClassName="slotC"
          viewId={visibleSlots[2]}
          active={activeView === visibleSlots[2] && activeSlot === 2}
          maximized={maxSlot === 2}
          onActivate={() => activateSlot(2)}
          onViewChange={(viewId) => setSlotView(2, viewId)}
        />
      )}
      {isQuad && <div className="viewportSplitter vertical bottom" onPointerDown={beginDrag('col')} />}
      {visibleSlots[3] && (
        <ViewportCell
          slotId={SLOT_IDS[3]}
          slotClassName="slotD"
          viewId={visibleSlots[3]}
          active={activeView === visibleSlots[3] && activeSlot === 3}
          maximized={maxSlot === 3}
          onActivate={() => activateSlot(3)}
          onViewChange={(viewId) => setSlotView(3, viewId)}
        />
      )}
    </div>
  );
}
