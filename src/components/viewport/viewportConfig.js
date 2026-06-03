import { ORTHO_CAMERA_DEFAULTS, ORTHO_VIEW_SETUP } from './orthoViewSetup.js';

/** @typedef {'top' | 'bottom' | 'front' | 'back' | 'right' | 'left' | 'perspective'} ViewportId */

/** @type {Record<ViewportId, { label: string, orthoView: import('./orthoViewSetup.js').OrthoViewId | null, camera: object }>} */
export const VIEWPORT_CONFIG = {
  top: {
    label: 'Top',
    orthoView: 'top',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  bottom: {
    label: 'Bottom',
    orthoView: 'bottom',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  front: {
    label: 'Front',
    orthoView: 'front',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  back: {
    label: 'Back',
    orthoView: 'back',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  right: {
    label: 'Right',
    orthoView: 'right',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  left: {
    label: 'Left',
    orthoView: 'left',
    camera: { ...ORTHO_CAMERA_DEFAULTS },
  },
  perspective: {
    label: 'Perspective',
    orthoView: null,
    camera: {
      position: [4, 3.5, 5],
      fov: 45,
      near: 0.1,
      far: 500,
    },
  },
};

/** kHED-style 2×2 layout */
export const QUAD_LAYOUT = [
  ['top', 'front'],
  ['right', 'perspective'],
];

export const VIEWPORT_OPTIONS = ['top', 'bottom', 'front', 'back', 'right', 'left', 'perspective'];

/** @deprecated Use ORTHO_VIEW_SETUP[view].gridRotation */
export const ORTHO_GRID_ROTATION = {
  top: ORTHO_VIEW_SETUP.top.gridRotation,
  bottom: ORTHO_VIEW_SETUP.bottom.gridRotation,
  front: ORTHO_VIEW_SETUP.front.gridRotation,
  back: ORTHO_VIEW_SETUP.back.gridRotation,
  right: ORTHO_VIEW_SETUP.right.gridRotation,
  left: ORTHO_VIEW_SETUP.left.gridRotation,
};
