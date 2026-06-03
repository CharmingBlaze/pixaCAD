/**
 * Blockbench-style sub-object selection visuals (kHED clone).
 *
 * Behaviors matched:
 * - Edit modes 1–4: object / vertex / edge / face
 * - LMB picks in the active mode; empty click clears sub-selection
 * - Shift+LMB: add to selection or toggle off if already selected
 * - Ctrl+LMB: remove from selection (deselect only)
 * - Perspective: LMB select, RMB orbit (OrbitControls LEFT=null, RIGHT=rotate)
 * - Ortho views: LMB select, pan on MMB; picking uses screen-space thresholds
 * - Face: semi-transparent warm fill + bright outline; hover preview
 * - Vertex: small cubes, larger when selected
 * - Edge: thick bright lines when selected
 */
export const SELECTION = {
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
};
