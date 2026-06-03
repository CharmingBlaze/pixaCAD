/**
 * Snap helpers shared by object transforms, vertex edits, and draw tools.
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @param {number} grid
 * @returns {[number, number, number]}
 */
export function snapVector3Components(x, y, z, grid) {
  if (!(grid > 0)) return [x, y, z];
  return [
    Math.round(x / grid) * grid,
    Math.round(y / grid) * grid,
    Math.round(z / grid) * grid,
  ];
}

/**
 * Object-level transforms use the full grid step (matches viewport grid lines).
 * @param {boolean} snapGrid
 * @param {number} gridSize
 */
export function objectSnapGrid(snapGrid, gridSize) {
  if (!snapGrid) return 0;
  return Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1;
}

/**
 * Vertex edits stay on a fine step so small mesh features remain adjustable.
 * @param {boolean} snapGrid
 * @param {number} gridSize
 */
export function vertexSnapGrid(snapGrid, gridSize) {
  if (!snapGrid) return 0;
  const g = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 0.01;
  return Math.min(g, 0.01);
}
