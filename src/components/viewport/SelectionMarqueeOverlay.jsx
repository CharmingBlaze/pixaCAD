/**
 * Viewport marquee rectangle — dashed frame, soft fill, corner brackets.
 * @param {{ left: number, top: number, width: number, height: number, crossing: boolean }} box
 */
export function SelectionMarqueeOverlay({ box }) {
  const w = Math.max(box.width, 1);
  const h = Math.max(box.height, 1);

  return (
    <div
      className={box.crossing ? 'selectionMarquee selectionMarquee--crossing' : 'selectionMarquee'}
      style={{ left: box.left, top: box.top, width: w, height: h }}
      aria-hidden
    >
      <div className="selectionMarqueeFill" />
      <svg className="selectionMarqueeSvg" width={w} height={h} aria-hidden>
        <rect
          x="1.25"
          y="1.25"
          width={Math.max(w - 2.5, 1)}
          height={Math.max(h - 2.5, 1)}
          rx="1"
          className="selectionMarqueeRect"
        />
      </svg>
      <span className="selectionMarqueeCorner selectionMarqueeCorner--tl" />
      <span className="selectionMarqueeCorner selectionMarqueeCorner--tr" />
      <span className="selectionMarqueeCorner selectionMarqueeCorner--bl" />
      <span className="selectionMarqueeCorner selectionMarqueeCorner--br" />
    </div>
  );
}
