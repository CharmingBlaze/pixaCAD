/**
 * Single source of truth for orthographic viewports (camera, grid, draw plane).
 * Y-up, right-handed. Opposite views share the same drawing/grid plane and flip camera side.
 */

/** @typedef {'top' | 'bottom' | 'front' | 'back' | 'right' | 'left'} OrthoViewId */

/** @type {Record<OrthoViewId, {
 *   position: [number, number, number],
 *   up: [number, number, number],
 *   gridRotation: [number, number, number],
 *   drawPlaneRotation: [number, number, number],
 * }>} */
export const ORTHO_VIEW_SETUP = {
  top: {
    position: [0, 24, 0],
    up: [0, 0, -1],
    /** Default grid lies on XZ (floor). */
    gridRotation: [0, 0, 0],
    /** planeGeometry XY → lay flat on XZ. */
    drawPlaneRotation: [-Math.PI / 2, 0, 0],
  },
  bottom: {
    position: [0, -24, 0],
    up: [0, 0, 1],
    gridRotation: [0, 0, 0],
    drawPlaneRotation: [-Math.PI / 2, 0, 0],
  },
  front: {
    position: [0, 0, 24],
    up: [0, 1, 0],
    /** XZ grid → rotate to XY wall at z = 0. */
    gridRotation: [-Math.PI / 2, 0, 0],
    /** planeGeometry stays on XY at z = 0. */
    drawPlaneRotation: [0, 0, 0],
  },
  back: {
    position: [0, 0, -24],
    up: [0, 1, 0],
    gridRotation: [-Math.PI / 2, 0, 0],
    drawPlaneRotation: [0, 0, 0],
  },
  right: {
    position: [24, 0, 0],
    up: [0, 1, 0],
    /** XZ grid → rotate to YZ wall at x = 0. */
    gridRotation: [0, 0, Math.PI / 2],
    drawPlaneRotation: [0, Math.PI / 2, 0],
  },
  left: {
    position: [-24, 0, 0],
    up: [0, 1, 0],
    gridRotation: [0, 0, Math.PI / 2],
    drawPlaneRotation: [0, Math.PI / 2, 0],
  },
};

export const ORTHO_CAMERA_DEFAULTS = {
  near: 0.1,
  far: 1000,
  zoom: 48,
};
