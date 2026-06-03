import * as THREE from 'three';

/** @typedef {{ axisX: string, axisY: string, axisZ: string, axisAccent: string, axisPrimary: string }} GizmoTheme */

/** @typedef {'x' | 'y' | 'z' | 'xy' | 'yz' | 'xz' | 'screen' | 'center' | 'gray' | null} GizmoAxisKind */

/** @param {string} name */
function axisKindFromObjectName(name) {
  if (!name) return null;
  if (name === 'X' || name === 'XYZX') return 'x';
  if (name === 'Y' || name === 'XYZY') return 'y';
  if (name === 'Z' || name === 'XYZZ') return 'z';
  if (name === 'XY') return 'xy';
  if (name === 'YZ') return 'yz';
  if (name === 'XZ') return 'xz';
  if (name === 'XYZ') return 'center';
  if (name === 'E' || name === 'XYZE') return 'screen';
  return null;
}

/** @param {number} hex */
function axisKindFromNativeHex(hex) {
  switch (hex) {
    case 0xff0000:
      return 'x';
    case 0x00ff00:
      return 'y';
    case 0x0000ff:
      return 'z';
    case 0x00ffff:
      return 'yz';
    case 0xff00ff:
      return 'xz';
    case 0x787878:
      return 'gray';
    default:
      return null;
  }
}

/** @param {string} a @param {string} b */
function mixHex(a, b, t = 0.5) {
  const parse = (hex) => {
    const h = hex.replace('#', '');
    const n = Number.parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * @param {GizmoTheme} theme
 * @param {GizmoAxisKind} kind
 */
function colorForAxisKind(theme, kind) {
  switch (kind) {
    case 'x':
      return theme.axisX;
    case 'y':
      return theme.axisY;
    case 'z':
      return theme.axisZ;
    case 'xy':
      return mixHex(theme.axisX, theme.axisY, 0.5);
    case 'yz':
      return mixHex(theme.axisY, theme.axisZ, 0.5);
    case 'xz':
      return mixHex(theme.axisX, theme.axisZ, 0.5);
    case 'screen':
      return theme.axisAccent;
    case 'center':
      return theme.axisPrimary;
    case 'gray':
      return theme.axisPrimary;
    default:
      return theme.axisAccent;
  }
}

/**
 * @param {THREE.Object3D} obj
 * @returns {GizmoAxisKind}
 */
function resolveAxisKind(obj) {
  if (obj.tag === 'helper') return 'gray';

  const byName = axisKindFromObjectName(obj.name);
  if (byName) return byName;

  const parentName = obj.parent?.name ?? '';
  const byParent = axisKindFromObjectName(parentName);
  if (byParent) return byParent;

  // Shared materials: only use hex when the handle name encodes the axis.
  if (obj.name === 'X' || obj.name === 'Y' || obj.name === 'Z') {
    const sample = obj.material?.tempColor ?? obj.material?.color;
    if (sample) return axisKindFromNativeHex(sample.getHex());
  }

  return null;
}

/**
 * Set the gizmo handle base color. TransformControls copies `tempColor` → `color` each
 * frame, then applies hover/axis highlights on `color` only — so theming must update `tempColor`.
 * @param {THREE.Material} mat
 * @param {THREE.Color} color
 */
function setMaterialBaseColor(mat, color) {
  if (!mat?.color) return;
  if (!mat.tempColor) mat.tempColor = color.clone();
  else mat.tempColor.copy(color);
}

/**
 * Recolor translate / rotate / scale TransformControls gizmos to match the active theme.
 * @param {import('three-stdlib').TransformControls | null | undefined} controls
 * @param {GizmoTheme} theme
 */
export function applyTransformGizmoTheme(controls, theme) {
  if (!controls) return;

  const scratch = new THREE.Color();

  controls.traverse((obj) => {
    const kind = resolveAxisKind(obj);
    const hex = colorForAxisKind(theme, kind);
    scratch.set(hex);

    ensureHandleMaterial(obj);
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const mat of materials) {
      setMaterialBaseColor(mat, scratch);
    }
  });
}

/**
 * Patch TransformControlsGizmo so theme base colors apply after three-stdlib resets handles.
 * @param {import('three-stdlib').TransformControls} controls
 * @param {() => GizmoTheme} getTheme
 */
export function installTransformGizmoThemeHook(controls, getTheme) {
  const gizmoRoot = controls?.gizmo;
  if (!gizmoRoot || gizmoRoot.userData.khedThemeHook === controls) return;

  const original = gizmoRoot.updateMatrixWorld.bind(gizmoRoot);
  gizmoRoot.updateMatrixWorld = function updateMatrixWorldWithTheme() {
    original();
    applyTransformGizmoTheme(controls, getTheme());
  };
  gizmoRoot.userData.khedThemeHook = controls;
  applyTransformGizmoTheme(controls, getTheme());
}

/**
 * three-stdlib shares one material across many handles; clone per named handle so
 * X/Y/Z/E/XY can each keep the correct theme color.
 * @param {THREE.Object3D} obj
 */
function ensureHandleMaterial(obj) {
  if (!obj.material || (!obj.name && obj.tag !== 'helper')) return;
  if (obj.userData.khedMaterialCloned) return;

  const source = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  if (!source?.clone) return;

  const clone = source.clone();
  clone.userData.khedOwned = true;
  if (source.tempColor && clone.color) {
    clone.tempColor = source.tempColor.clone();
  }
  obj.material = clone;
  obj.userData.khedMaterialCloned = true;
}
