import { useMemo } from 'react';
import { useEditorStore } from '../store/editorStore.js';

/** @typedef {{
 *   background: string,
 *   gridCell: string,
 *   gridSection: string,
 *   gridOrigin: string,
 *   gridCellThickness: number,
 *   gridSectionThickness: number,
 *   gridFadeDistance: number,
 *   gridFadeStrength: number,
 *   axisPrimary: string,
 *   axisAccent: string,
 *   axisX: string,
 *   axisY: string,
 *   axisZ: string,
 *   selection: {
 *     selected: string,
 *     selectedBright: string,
 *     hover: string,
 *     edgeIdle: string,
 *     edgeHover: string,
 *     vertexIdle: string,
 *     vertexOutline: string,
 *     faceFill: string,
 *     faceHoverFill: string,
 *     faceFillOpacity: number,
 *     faceHoverOpacity: number,
 *     faceOutline: string,
 *     faceHoverOutline: string,
 *     faceEdgeOpacity: number,
 *     faceHoverEdgeOpacity: number,
 *     knifeValid: string,
 *     knifeInvalid: string,
 *   },
 * }} ViewportTheme */

const GRID = {
  gridCellThickness: 0.45,
  gridSectionThickness: 0.85,
  gridFadeDistance: 60,
  gridFadeStrength: 0.35,
};

/** @type {ViewportTheme} */
export const VIEWPORT_THEME_FALLBACK = {
  background: '#586878',
  gridCell: '#7d8a9a',
  gridSection: '#a3b1c2',
  gridOrigin: '#dce4ee',
  ...GRID,
  axisPrimary: '#e8ecf2',
  axisAccent: '#5ec8e8',
  axisX: '#ff6b6b',
  axisY: '#6bff8a',
  axisZ: '#6babff',
  selection: {
    selected: '#ff5a1f',
    selectedBright: '#ffb340',
    hover: '#fff15a',
    edgeIdle: '#6a8ab0',
    edgeHover: '#9ab8d8',
    vertexIdle: '#43d7ff',
    vertexOutline: '#05080d',
    faceFill: '#ff8a4d',
    faceHoverFill: '#ffe566',
    faceFillOpacity: 0.26,
    faceHoverOpacity: 0.14,
    faceOutline: '#ffd49a',
    faceHoverOutline: '#fff0c8',
    faceEdgeOpacity: 0.92,
    faceHoverEdgeOpacity: 0.75,
    knifeValid: '#ffcc44',
    knifeInvalid: '#ff6b6b',
  },
};

/** @param {HTMLElement | null} root */
function readViewportTheme(root) {
  if (!root) return VIEWPORT_THEME_FALLBACK;
  const style = getComputedStyle(root);
  const g = (name, fallback = '') => style.getPropertyValue(name).trim() || fallback;

  const vertex = g('--t-vp-vertex', VIEWPORT_THEME_FALLBACK.selection.vertexIdle);
  const vertexSelected = g('--t-vp-vertex-selected', VIEWPORT_THEME_FALLBACK.selection.selected);
  const vertexHover = g('--t-vp-vertex-hover', VIEWPORT_THEME_FALLBACK.selection.hover);

  return {
    background: g('--t-vp-bg', g('--t-viewport-bg', VIEWPORT_THEME_FALLBACK.background)),
    gridCell: g('--t-vp-grid-cell', VIEWPORT_THEME_FALLBACK.gridCell),
    gridSection: g('--t-vp-grid-section', VIEWPORT_THEME_FALLBACK.gridSection),
    gridOrigin: g('--t-vp-grid-origin', VIEWPORT_THEME_FALLBACK.gridOrigin),
    ...GRID,
    axisPrimary: g('--t-vp-axis-primary', VIEWPORT_THEME_FALLBACK.axisPrimary),
    axisAccent: g('--t-vp-axis-accent', VIEWPORT_THEME_FALLBACK.axisAccent),
    axisX: g('--t-vp-axis-x', VIEWPORT_THEME_FALLBACK.axisX),
    axisY: g('--t-vp-axis-y', VIEWPORT_THEME_FALLBACK.axisY),
    axisZ: g('--t-vp-axis-z', VIEWPORT_THEME_FALLBACK.axisZ),
    selection: {
      selected: vertexSelected,
      selectedBright: vertexHover,
      hover: vertexHover,
      edgeIdle: g('--t-vp-edge', VIEWPORT_THEME_FALLBACK.selection.edgeIdle),
      edgeHover: g('--t-vp-edge-hover', VIEWPORT_THEME_FALLBACK.selection.edgeHover),
      edgeSelected: g('--t-vp-edge-selected', VIEWPORT_THEME_FALLBACK.selection.selected),
      vertexIdle: vertex,
      vertexSelected: vertexSelected,
      vertexOutline: g('--t-vp-vertex-outline', VIEWPORT_THEME_FALLBACK.selection.vertexOutline),
      faceFill: g('--t-vp-face-fill', VIEWPORT_THEME_FALLBACK.selection.faceFill),
      faceHoverFill: g('--t-vp-face-hover-fill', VIEWPORT_THEME_FALLBACK.selection.faceHoverFill),
      faceFillOpacity: 0.28,
      faceHoverOpacity: 0.16,
      faceOutline: g('--t-vp-face-outline', VIEWPORT_THEME_FALLBACK.selection.faceOutline),
      faceHoverOutline: g('--t-vp-face-hover-outline', VIEWPORT_THEME_FALLBACK.selection.faceHoverOutline),
      faceEdgeOpacity: 0.92,
      faceHoverEdgeOpacity: 0.78,
      knifeValid: g('--t-vp-knife-valid', VIEWPORT_THEME_FALLBACK.selection.knifeValid),
      knifeInvalid: g('--t-vp-knife-invalid', VIEWPORT_THEME_FALLBACK.selection.knifeInvalid),
    },
  };
}

/** Live viewport + sub-object colors from the active CSS theme. */
export function useViewportTheme() {
  const themeId = useEditorStore((s) => s.themeId);
  return useMemo(() => readViewportTheme(document.querySelector('.khedApp')), [themeId]);
}

/** Non-hook read (e.g. tests). */
export function getViewportThemeFromDom() {
  return readViewportTheme(document.querySelector('.khedApp'));
}
