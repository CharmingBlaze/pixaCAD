export const BRAND_NAME = 'pixaCAD';
export const APP_ID = 'pixacad';
export const LEGACY_APP_IDS = ['khed-clone'];

export const PROJECT_FILE_NAME = 'scene.pixacad.json';
export const PROJECT_FILE_ACCEPT = '.pixacad.json,.khed.json,.json,application/json';

/** @param {unknown} app */
export function isValidProjectApp(app) {
  return app === APP_ID || LEGACY_APP_IDS.includes(app);
}
