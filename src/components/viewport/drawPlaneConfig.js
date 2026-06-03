import { ORTHO_VIEW_SETUP } from './orthoViewSetup.js';

/** Draw-plane rotation (planeGeometry is XY, normal +Z). */
export const DRAW_PLANE_ROTATION = {
  top: ORTHO_VIEW_SETUP.top.drawPlaneRotation,
  bottom: ORTHO_VIEW_SETUP.bottom.drawPlaneRotation,
  front: ORTHO_VIEW_SETUP.front.drawPlaneRotation,
  back: ORTHO_VIEW_SETUP.back.drawPlaneRotation,
  right: ORTHO_VIEW_SETUP.right.drawPlaneRotation,
  left: ORTHO_VIEW_SETUP.left.drawPlaneRotation,
  perspective: ORTHO_VIEW_SETUP.top.drawPlaneRotation,
};
