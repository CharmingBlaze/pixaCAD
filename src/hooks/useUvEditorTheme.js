import { useMemo } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { hexToRgba, parseHex, readKhedThemeVar } from '../lib/theme/readThemeVar.js';
import { getViewportThemeFromDom } from './useViewportTheme.js';

/** Live UV editor canvas colors — aligned with the main viewport theme. */
export function useUvEditorTheme() {
  const themeId = useEditorStore((s) => s.themeId);

  return useMemo(() => {
    const vp = getViewportThemeFromDom();
    const accent = readKhedThemeVar('--t-accent', '#316ac5');
    const brand = readKhedThemeVar('--t-brand', '#003399');
    const accentOn = readKhedThemeVar('--t-accent-on', '#ffffff');
    const bodyText = readKhedThemeVar('--t-body-text', '#111111');
    const [tr, tg, tb] = parseHex(bodyText);
    const sel = vp.selection;

    return {
      workspaceBg: vp.background,
      checkerA: vp.gridCell,
      checkerB: vp.gridSection,
      uvBounds: vp.gridOrigin,
      wireIdle: hexToRgba(vp.axisPrimary, 0.9),
      wireSelected: sel.faceHoverOutline,
      faceSelectedFill: hexToRgba(sel.faceFill, 0.42),
      vertexSelected: sel.vertexSelected,
      vertexOutline: accentOn,
      marqueeFill: hexToRgba(accent, 0.16),
      marqueeStroke: hexToRgba(accent, 0.95),
      marqueeCrossFill: hexToRgba(sel.faceHoverFill, 0.16),
      marqueeCrossStroke: hexToRgba(sel.knifeValid, 0.95),
      handleBox: hexToRgba(accent, 0.95),
      handleLine: hexToRgba(brand, 0.95),
      handleFill: readKhedThemeVar('--t-surface', '#ffffff'),
      handleStroke: accent,
      statusOverlayBg: `rgba(${tr}, ${tg}, ${tb}, 0.55)`,
      statusOverlayText: accentOn,
    };
  }, [themeId]);
}
