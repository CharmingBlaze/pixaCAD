import { DEFAULT_PAINT_COLOR } from './defaultColors.js';

/** @param {HTMLElement | null} [root] */
export function getThemeMaterialDefault(root = document.querySelector('.khedApp')) {
  if (!root) return DEFAULT_PAINT_COLOR;
  const value = getComputedStyle(root).getPropertyValue('--t-material-default').trim();
  return value || DEFAULT_PAINT_COLOR;
}
