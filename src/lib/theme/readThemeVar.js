/** @param {string} name @param {string} fallback */
export function readKhedThemeVar(name, fallback) {
  if (typeof document === 'undefined') return fallback;
  const root = document.querySelector('.khedApp') ?? document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(name).trim();
  return value || fallback;
}

/** @param {string} hex @returns {[number, number, number, number]} */
export function parseHex(hex) {
  const value = hex.replace('#', '');
  const n = Number.parseInt(value, 16);
  if (!Number.isFinite(n)) return [255, 255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

/** @param {string} hex @param {number} alpha */
export function hexToRgba(hex, alpha = 1) {
  const [r, g, b] = parseHex(hex);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
