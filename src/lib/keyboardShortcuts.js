/**
 * Keyboard shortcut reference for the Help menu.
 * Keep in sync with useKeyboardShortcuts.js and editor-specific handlers.
 *
 * @typedef {{ keys: string[], description: string, hint?: string }} ShortcutItem
 * @typedef {{ id: string, title: string, items: ShortcutItem[] }} ShortcutSection
 */

/** @type {ShortcutSection[]} */
export const MAIN_EDITOR_SHORTCUTS = [
  {
    id: 'modes',
    title: 'Edit modes',
    items: [
      { keys: ['1'], description: 'Object mode' },
      { keys: ['2'], description: 'Vertex mode' },
      { keys: ['3'], description: 'Edge mode' },
      { keys: ['4'], description: 'Face mode' },
    ],
  },
  {
    id: 'transform',
    title: 'Transform',
    items: [
      { keys: ['G'], description: 'Move (translate gizmo)' },
      { keys: ['R'], description: 'Rotate gizmo' },
      { keys: ['S'], description: 'Scale gizmo' },
      { keys: ['Shift', 'R'], description: 'Interactive rotate (objects or sub-selection)' },
      { keys: ['Shift', 'S'], description: 'Interactive scale (objects or sub-selection)' },
      { keys: ['X'], description: 'Lock translate to X axis (object mode)', hint: 'release to unlock' },
      { keys: ['Y'], description: 'Lock translate to Y axis (object mode)', hint: 'release to unlock' },
      { keys: ['Z'], description: 'Lock translate to Z axis (object mode)', hint: 'release to unlock' },
      { keys: ['↑', '↓', '←', '→'], description: 'Nudge selection' },
      { keys: ['Shift', 'Arrows'], description: 'Nudge selection (larger step)' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Snap selection to grid' },
    ],
  },
  {
    id: 'history',
    title: 'History & clipboard',
    items: [
      { keys: ['Ctrl', 'S'], description: 'Save project' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['Ctrl', 'C'], description: 'Copy object' },
      { keys: ['Ctrl', 'V'], description: 'Paste object' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate object' },
    ],
  },
  {
    id: 'mesh',
    title: 'Mesh tools',
    items: [
      { keys: ['E'], description: 'Extrude faces or edges' },
      { keys: ['I'], description: 'Inset faces (face mode)' },
      { keys: ['Enter'], description: 'Confirm extrude / loop cut / bevel', hint: 'while tool active' },
      { keys: ['K'], description: 'Knife tool (toggle)' },
      { keys: ['L'], description: 'Loop cut (edge mode)' },
      { keys: ['B'], description: 'Bevel edges' },
      { keys: ['Ctrl', 'B'], description: 'Bevel edges' },
      { keys: ['J'], description: 'Split selected edges' },
      { keys: ['M'], description: 'Merge selection to center' },
      { keys: ['F'], description: 'Create face from selection' },
      { keys: ['Shift', 'F'], description: 'Paint faces with active color' },
      { keys: ['Shift', 'L'], description: 'Select edge loop' },
      { keys: ['Alt', 'R'], description: 'Select edge ring' },
      { keys: ['Alt', 'X'], description: 'Mirror selection on X' },
    ],
  },
  {
    id: 'poly',
    title: 'Poly draw',
    items: [
      { keys: ['Enter'], description: 'Fill polygon face' },
      { keys: ['Backspace'], description: 'Undo last placed point' },
    ],
  },
  {
    id: 'selection',
    title: 'Selection & delete',
    items: [
      { keys: ['LMB'], description: 'Select / replace selection' },
      { keys: ['Shift', 'LMB'], description: 'Add or toggle in selection' },
      { keys: ['Ctrl', 'LMB'], description: 'Remove from selection' },
      { keys: ['Del'], description: 'Delete selection' },
      { keys: ['Backspace'], description: 'Delete selection', hint: 'when not poly drawing' },
      { keys: ['Esc'], description: 'Cancel active tool, then clear selection' },
    ],
  },
  {
    id: 'view',
    title: 'View & viewport',
    items: [
      { keys: ['W'], description: 'Toggle wireframe overlay' },
      { keys: ['Alt', 'Z'], description: 'Toggle X-Ray' },
      { keys: ['Space'], description: 'Maximize active viewport cell' },
    ],
  },
];

/** @type {ShortcutSection[]} */
export const UV_EDITOR_SHORTCUTS = [
  {
    id: 'uv',
    title: 'UV editor',
    items: [
      { keys: ['A'], description: 'Select all faces' },
      { keys: ['U'], description: 'Unwrap selection' },
    ],
  },
];

/** @type {ShortcutSection[]} */
export const PIXEL_EDITOR_SHORTCUTS = [
  {
    id: 'pixel-tools',
    title: 'Pixel editor — tools',
    items: [
      { keys: ['B'], description: 'Brush' },
      { keys: ['P'], description: 'Pixel pencil' },
      { keys: ['E'], description: 'Eraser' },
      { keys: ['L'], description: 'Line' },
      { keys: ['R'], description: 'Rectangle' },
      { keys: ['C'], description: 'Circle' },
      { keys: ['F'], description: 'Fill bucket' },
      { keys: ['I'], description: 'Eyedropper' },
      { keys: ['H'], description: 'Pan (hand)' },
    ],
  },
  {
    id: 'pixel-view',
    title: 'Pixel editor — canvas',
    items: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['['], description: 'Decrease brush size' },
      { keys: [']'], description: 'Increase brush size' },
      { keys: ['+'], description: 'Zoom in' },
      { keys: ['−'], description: 'Zoom out' },
      { keys: ['0'], description: 'Fit view to canvas' },
    ],
  },
];

/** @returns {string} */
export function modKeyLabel() {
  if (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform)) {
    return '⌘';
  }
  return 'Ctrl';
}

/**
 * @param {string[]} keys
 * @returns {string[]}
 */
export function displayShortcutKeys(keys) {
  const mod = modKeyLabel();
  return keys.map((k) => {
    if (k === 'Ctrl') return mod;
    if (k === 'Cmd') return '⌘';
    return k;
  });
}
