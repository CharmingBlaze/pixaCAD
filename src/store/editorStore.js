import { create } from 'zustand';
import * as THREE from 'three';
import { DEFAULT_PAINT_COLOR } from '../lib/defaultColors.js';
import { getThemeMaterialDefault } from '../lib/themeMaterial.js';
import { uid } from '../lib/id.js';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { createPrimitive, createPrimitiveForDrawView, scaleForBox } from '../lib/mesh/primitives.js';
import { copyVec3, snapPoint } from '../lib/draw/drawBox.js';
import {
  buildBoxFromDraw,
  boxMetrics,
  projectToDrawPlane,
  formatDrawSize,
  DEFAULT_HEIGHT,
} from '../lib/draw/cadDraw.js';
import { localToWorld, worldToLocal } from '../lib/mesh/transform.js';
import { verticesFromEdgeKeys, verticesFromFaceIndices } from '../lib/mesh/edgeKeys.js';
import { collectEdgeLoop, collectEdgeRing } from '../lib/mesh/loopTools.js';
import { createUndoStack } from '../lib/history/undoStack.js';
import { captureHistoryState, restoreObjects, applyHistorySnapshot } from './historyHelpers.js';
import { applyListSelection, getSelectionSummary } from './selection.js';
import {
  coalesceSelectedIds,
  filterOutAncestorSelections,
  nextObjectSelection,
  nextObjectSelectionBatch,
} from './objectSelection.js';
import { buildGroupedObjects, ungroupChildren } from '../lib/scene/groupTransform.js';
import { snapPointToMeshFeatures } from '../lib/snap/meshSnap.js';
import {
  copySelectionSnapshots,
  duplicateSubtrees,
  pasteObjectSnapshots,
} from '../lib/scene/sceneClipboard.js';
import { loadAutosaveProject, listRecentProjects, saveAutosaveProject } from '../lib/autosave/projectAutosave.js';
import { normalizeLoadedProject, projectSnapshot } from '../export/project.js';
import { snapVector3Components, vertexSnapGrid } from '../lib/snap/gridSnap.js';
import {
  arrowWorldDelta,
  nudgeMeshVerticesWorld,
  nudgeStepForMode,
  nudgedObjectPosition,
} from '../lib/viewport/viewportNudge.js';
import { isInteractionBlocked } from './interaction.js';
import {
  extrudeFaces,
  extrudeEdges,
  knifeCutFace,
  bevelEdges,
  weldVertices,
  weldSelectedVertices,
  insetFaces,
  decimateMesh,
  subdivideFaces,
  mirrorMesh,
  flipMeshAcrossAxis,
  flipFaceNormals,
  paintFaces,
  removeFaces,
  removeVertices,
  splitEdges,
  removeFacesWithEdges,
  findOrAddVertex,
  addFace,
  mergeVerticesToCenter,
  loopCutEdges,
  loopCutFactors,
} from '../lib/mesh/operations.js';
import {
  applyPositionsToMeshInPlace,
  captureVertexPositions,
  meshTranslateVertices,
  meshWithVertexDelta,
  meshWithVertexPositions,
  rotatePositionsFromPivot,
  snapVertexDelta,
  vertexCentroid,
} from '../lib/mesh/vertexManip.js';
import {
  resolveSubObjectTransformVertices,
  rotatePositionsInViewSpace,
  scalePositionsInViewSpace,
} from '../lib/mesh/subObjectTransform.js';
import { scaleFactorsFromAxisLock } from '../lib/viewport/blenderScaleInput.js';
import { localPointOnFace } from '../lib/mesh/knifePick.js';
import {
  applyObjectInteractiveTransform,
  captureObjectInteractiveSession,
} from '../lib/scene/objectInteractiveTransform.js';
import {
  inactiveToolState,
  isPolyDrawEngaged,
  extrudeSessionEndState,
  knifeFinishedState,
  normalizeStrandedEditMode,
  polyDrawContinuedPatch,
  polyDrawFinishedState,
  polyDrawSessionEndState,
} from './toolState.js';
import { readStoredThemeId, persistThemeId, themeLabel } from '../lib/themes.js';
import { evaluateObjectMesh } from '../lib/mesh/modifiers.js';

/** @typedef {'object' | 'vertex' | 'edge' | 'face'} EditMode */
/** @typedef {'translate' | 'rotate' | 'scale'} TransformMode */
/** @typedef {'X' | 'Y' | 'Z' | null} GizmoAxisLock */
/** @typedef {'solid' | 'textured' | 'wireframe' | 'outline'} RenderMode */
/** @typedef {'quad' | 'single' | 'splitVertical' | 'splitHorizontal'} ViewportLayoutMode */
/** @typedef {'select' | 'extrude' | 'polyDraw' | 'primitiveDraw' | 'knife' | 'loopCut' | 'bevel'} ActiveTool */
/** @typedef {'plane' | 'gizmo' | 'interactive'} VertexManipKind */

/**
 * @typedef {Object} VertexManipSession
 * @property {string} objectId
 * @property {import('../components/viewport/viewportConfig.js').ViewportId | null} sourceViewId
 * @property {VertexManipKind} kind
 * @property {number[]} vertexIndices
 * @property {[number, number, number][]} startPositions
 * @property {[number, number, number]} startCentroidLocal
 * @property {[number, number, number] | null} [startPivotWorld]
 * @property {boolean} historyCommitted
 */

/**
 * @typedef {Object} SceneObject
 * @property {string} id
 * @property {string} name
 * @property {string | null} parentId
 * @property {boolean} isGroup
 * @property {import('../lib/mesh/EditableMesh.js').EditableMesh | null} mesh
 * @property {[number, number, number]} position
 * @property {[number, number, number]} rotation
 * @property {[number, number, number]} scale
 * @property {string | null} textureDataUrl
 * @property {{ id: string, name: string, visible: boolean, opacity: number, kind?: string, dataUrl: string | null }[]} textureLayers
 * @property {number} textureRevision
 * @property {{ mirrorEnabled?: boolean, mirrorAxis?: 'x' | 'y' | 'z', subdivisionLevel?: number }} meshModifiers
 * @property {boolean} visible
 * @property {boolean} locked
 */

/** @typedef {ReturnType<typeof useEditorStore.getState>} EditorState */

const undoStack = createUndoStack();
const textureCanvasCache = new Map();
const textureSyncScheduled = new Map();
const texturePreviewScheduled = new Map();
const textureCompositeTokens = new Map();

export function getLiveTextureCanvas(objectId) {
  return textureCanvasCache.get(objectId)?.canvas ?? null;
}

function bumpObjectTextureRevision(set, id, statusMessage) {
  set((s) => ({
    objects: s.objects.map((o) => (o.id === id ? { ...o, textureRevision: (o.textureRevision ?? 0) + 1 } : o)),
    statusMessage,
  }));
}

function scheduleObjectTextureRevision(set, id, statusMessage) {
  if (texturePreviewScheduled.get(id)) return;
  texturePreviewScheduled.set(id, true);
  const schedule = globalThis.requestAnimationFrame ?? ((callback) => globalThis.setTimeout(callback, 16));
  schedule(() => {
    texturePreviewScheduled.delete(id);
    bumpObjectTextureRevision(set, id, statusMessage);
  });
}

function clearAllTextureCaches() {
  textureCanvasCache.clear();
  textureSyncScheduled.clear();
  texturePreviewScheduled.clear();
  textureCompositeTokens.clear();
}

function parseHexColor(hex) {
  const value = String(hex ?? '#ffffff').replace('#', '');
  const n = Number.parseInt(value, 16);
  if (!Number.isFinite(n)) return [255, 255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

function getTextureCanvas(objectId, dataUrl, onReady) {
  const cached = textureCanvasCache.get(objectId);
  if (cached && cached.dataUrl === dataUrl && cached.canvas) {
    onReady(cached.canvas);
    return;
  }
  if (cached && cached.dataUrl === dataUrl && cached.loading) {
    cached.callbacks.push(onReady);
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (!dataUrl) {
    canvas.width = 512;
    canvas.height = 512;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textureCanvasCache.set(objectId, { dataUrl: null, canvas });
    onReady(canvas);
    return;
  }

  const callbacks = [onReady];
  textureCanvasCache.set(objectId, { dataUrl, canvas: null, loading: true, callbacks });
  const img = new Image();
  img.onload = () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    textureCanvasCache.set(objectId, { dataUrl, canvas });
    for (const callback of callbacks) callback(canvas);
  };
  img.onerror = () => {
    canvas.width = 512;
    canvas.height = 512;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    textureCanvasCache.set(objectId, { dataUrl: null, canvas });
    for (const callback of callbacks) callback(canvas);
  };
  img.src = dataUrl;
}

function normalizeTextureLayers(textureLayers) {
  if (!Array.isArray(textureLayers)) return [];
  return textureLayers
    .filter((layer) => layer && typeof layer === 'object')
    .map((layer, index) => ({
      id: String(layer.id || `texture_layer_${Date.now().toString(36)}_${index}`),
      name: String(layer.name || 'Layer'),
      visible: layer.visible !== false,
      opacity: Number.isFinite(Number(layer.opacity)) ? Math.max(0, Math.min(1, Number(layer.opacity))) : 1,
      kind: typeof layer.kind === 'string' ? layer.kind : 'paint',
      dataUrl: typeof layer.dataUrl === 'string' ? layer.dataUrl : null,
    }));
}

function loadTextureLayerImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function scheduleTextureDataUrlSync(id, canvas, set, get) {
  const cached = textureCanvasCache.get(id);
  textureCanvasCache.set(id, { dataUrl: cached?.dataUrl ?? null, canvas });

  if (!textureSyncScheduled.get(id)) {
    const token = (textureCompositeTokens.get(id) ?? 0) + 1;
    textureCompositeTokens.set(id, token);
    textureSyncScheduled.set(id, true);
    globalThis.setTimeout(() => {
      textureSyncScheduled.set(id, false);
      if (textureCompositeTokens.get(id) !== token) return;
      const latest = textureCanvasCache.get(id);
      if (!latest?.canvas) return;
      const dataUrl = latest.canvas.toDataURL('image/png');
      textureCanvasCache.set(id, { dataUrl, canvas: latest.canvas });
      const textureLayers = [{
        id: `texture_layer_${Date.now().toString(36)}`,
        name: 'Texture',
        visible: true,
        opacity: 1,
        kind: 'image',
        dataUrl,
      }];
      set((s) => ({
        objects: s.objects.map((o) => (o.id === id
          ? { ...o, textureDataUrl: dataUrl, textureLayers, textureRevision: (o.textureRevision ?? 0) + 1 }
          : o)),
        statusMessage: 'Painting texture',
      }));
    }, 180);
  }

  scheduleObjectTextureRevision(set, id, 'Painting texture');
}

function paintTextureDab(canvas, u, v, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { color = '#ff7a36', brushSize = 3, erase = false, opacity = 1, pixelPerfect = false } = options;
  const px = Math.round(Math.max(0, Math.min(1, u)) * (canvas.width - 1));
  const py = Math.round((1 - Math.max(0, Math.min(1, v))) * (canvas.height - 1));
  const r = Math.max(1, Math.floor(brushSize));
  if (erase) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    if (pixelPerfect) {
      const left = Math.round(px - (r - 1) / 2);
      const top = Math.round(py - (r - 1) / 2);
      ctx.fillRect(left, top, r, r);
    } else {
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  const rgba = parseHexColor(color);
  const a = Math.max(0, Math.min(1, opacity));
  ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${a})`;
  if (pixelPerfect) {
    const left = Math.round(px - (r - 1) / 2);
    const top = Math.round(py - (r - 1) / 2);
    ctx.fillRect(left, top, r, r);
    return;
  }
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
}

function paintTextureStroke(canvas, fromU, fromV, toU, toV, options = {}) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const brushSize = Math.max(1, Math.floor(options.brushSize ?? 3));
  const pixelPerfect = !!options.pixelPerfect;
  const dx = (toU - fromU) * canvas.width;
  const dy = (toV - fromV) * canvas.height;
  if (!pixelPerfect) {
    const x1 = Math.round(Math.max(0, Math.min(1, fromU)) * (canvas.width - 1));
    const y1 = Math.round((1 - Math.max(0, Math.min(1, fromV))) * (canvas.height - 1));
    const x2 = Math.round(Math.max(0, Math.min(1, toU)) * (canvas.width - 1));
    const y2 = Math.round((1 - Math.max(0, Math.min(1, toV))) * (canvas.height - 1));
    ctx.save();
    if (options.erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = '#000';
    } else {
      const rgba = parseHexColor(options.color ?? '#ff7a36');
      const a = Math.max(0, Math.min(1, options.opacity ?? 1));
      ctx.strokeStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${a})`;
    }
    ctx.lineWidth = brushSize * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, brushSize)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    paintTextureDab(canvas, fromU + (toU - fromU) * t, fromV + (toV - fromV) * t, options);
  }
}

async function compositeTextureLayers(textureLayers) {
  const layers = normalizeTextureLayers(textureLayers);
  const loaded = [];
  for (const layer of layers) {
    const img = await loadTextureLayerImage(layer.dataUrl);
    if (img) loaded.push({ layer, img });
  }
  const first = loaded[0]?.img;
  if (!first) return null;
  const canvas = document.createElement('canvas');
  canvas.width = first.naturalWidth || first.width || 1;
  canvas.height = first.naturalHeight || first.height || 1;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const { layer, img } of loaded) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
  return canvas.toDataURL('image/png');
}

function statusWithSelection(state, message) {
  const sel = getSelectionSummary(state);
  return sel === 'Nothing selected' ? message : `${message} · ${sel}`;
}

function edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function meshEdgeKeySet(mesh) {
  return new Set(mesh.getEdges().map(([a, b]) => edgeKey(a, b)));
}

function sanitizeSubSelectionForMesh(state, mesh) {
  const edgeKeys = meshEdgeKeySet(mesh);
  return {
    selectedVertices: state.selectedVertices.filter((vi) => vi >= 0 && vi < mesh.vertexCount),
    selectedEdges: state.selectedEdges.filter((key) => edgeKeys.has(key)),
    selectedFaces: state.selectedFaces.filter((fi) => fi >= 0 && fi < mesh.faceCount),
    hoveredVertex:
      state.hoveredVertex !== null && state.hoveredVertex >= 0 && state.hoveredVertex < mesh.vertexCount
        ? state.hoveredVertex
        : null,
    hoveredEdge: state.hoveredEdge && edgeKeys.has(state.hoveredEdge) ? state.hoveredEdge : null,
    hoveredFace:
      state.hoveredFace !== null && state.hoveredFace >= 0 && state.hoveredFace < mesh.faceCount
        ? state.hoveredFace
        : null,
  };
}

function polyFacePointCount(mode) {
  if (mode === 'tri') return 3;
  if (mode === 'quad') return 4;
  return null;
}

function polyDrawFaceCommittedMessage(mode) {
  const label = mode === 'tri' ? 'triangle' : mode === 'quad' ? 'quad' : 'face';
  return `Added ${label} — keep drawing (Esc or Poly Draw to finish)`;
}

function syncActiveTool(state) {
  if (state.extrudeActive) return 'extrude';
  if (state.loopCutActive) return 'loopCut';
  if (state.bevelActive) return 'bevel';
  if (state.knifeActive) return 'knife';
  if (state.polyDrawActive) return 'polyDraw';
  if (state.pendingPrimitive) return 'primitiveDraw';
  return 'select';
}

function drawHeightStatus(state, height) {
  const { drawStart, drawCorner2, drawViewId } = state;
  if (!drawStart || !drawCorner2 || !drawViewId) {
    return `Height: ${height.toFixed(2)} — click to place`;
  }
  const { min, max } = buildBoxFromDraw(drawStart, drawCorner2, height, drawViewId);
  const label = formatDrawSize(boxMetrics(min, max).size);
  return `Height: ${height.toFixed(2)} · ${label} — click to place`;
}

function meshBoundsCenter(mesh) {
  if (!mesh || mesh.vertexCount === 0) return [0, 0, 0];
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < mesh.vertexCount; i++) {
    const [x, y, z] = mesh.getPosition(i);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
}

function objectWithMeshPivotAtBoundsCenter(object, mesh) {
  if (!object?.mesh || !mesh || mesh.vertexCount === 0) return { object, mesh };

  const centerLocal = meshBoundsCenter(mesh);
  if (centerLocal.every((n) => Math.abs(n) < 1e-8)) return { object: { ...object, mesh }, mesh };

  const centeredMesh = mesh.clone();
  for (let i = 0; i < centeredMesh.vertexCount; i++) {
    const [x, y, z] = centeredMesh.getPosition(i);
    centeredMesh.setPosition(i, x - centerLocal[0], y - centerLocal[1], z - centerLocal[2]);
  }

  return {
    object: {
      ...object,
      mesh: centeredMesh,
      position: localToWorld(centerLocal, object),
    },
    mesh: centeredMesh,
  };
}

function commitPolyDrawMeshState(state, objectId, mesh, statusMessage, recenterPivot = false) {
  return {
    objects: state.objects.map((o) =>
      o.id === objectId && o.mesh
        ? recenterPivot
          ? objectWithMeshPivotAtBoundsCenter(o, mesh).object
          : { ...o, mesh }
        : o,
    ),
    meshRevision: state.meshRevision + 1,
    ...polyDrawContinuedPatch(objectId, statusMessage),
  };
}

/**
 * Vertex editing needs finer snapping than object-level transforms,
 * especially after poly-draw where local features can be very small.
 * @param {boolean} snapGrid
 * @param {number} gridSize
 */
function vertexSnapParams(snapGrid, gridSize) {
  const grid = vertexSnapGrid(snapGrid, gridSize);
  return { enabled: grid > 0, grid };
}

export const useEditorStore = create((set, get) => ({
  objects: [],
  objectClipboard: null,
  selectedId: null,
  selectedIds: [],
  editMode: /** @type {EditMode} */ ('object'),
  transformMode: /** @type {TransformMode} */ ('translate'),
  gizmoAxisLock: /** @type {GizmoAxisLock} */ (null),
  selectedVertices: [],
  selectedEdges: [],
  selectedFaces: [],
  /** @type {number | null} */
  hoveredFace: null,
  /** @type {number | null} */
  hoveredVertex: null,
  /** @type {string | null} */
  hoveredEdge: null,
  paintColor: DEFAULT_PAINT_COLOR,
  showWireframe: true,
  showNormals: false,
  showXRay: false,
  showGrid: true,
  renderMode: /** @type {RenderMode} */ ('textured'),
  viewportLayoutMode: /** @type {ViewportLayoutMode} */ ('quad'),
  /** @type {Record<string, Array<{id: string, name: string, dataUrl: string, x: number, y: number, width: number, height: number, rotation: number, opacity: number, locked: boolean}>>} */
  referenceImagesByView: {},
  snapGrid: false,
  gridSize: 1,
  weldThreshold: 0.08,
  snapToMeshFeatures: false,
  statusMessage: 'Ready',
  pendingPrimitive: null,
  activeViewport: /** @type {import('../components/viewport/viewportConfig.js').ViewportId} */ ('perspective'),
  /** Viewport slot (a–d) whose camera drives arrow-key nudging. */
  activeViewportSlot: 'd',
  /** @type {'idle' | 'width' | 'height'} */
  drawPhase: 'idle',
  drawStart: null,
  drawCorner2: null,
  drawHeight: DEFAULT_HEIGHT,
  drawViewId: null,
  /** Incremented on each draw geometry change so R3F preview remounts/invalidates. */
  drawRevision: 0,
  polyDrawActive: false,
  /** @type {'tri' | 'quad' | 'poly'} */
  polyFaceMode: 'quad',
  polyDrawVerts: [],
  polyDrawTargetId: null,
  polyDrawCreatedObject: false,
  polyDrawRevertOnCancel: false,
  polyDrawAnchor: null,
  polyDrawBaseMesh: null,
  extrudeActive: false,
  extrudeBaseMesh: null,
  extrudeFaceIndices: [],
  extrudeDistance: 0,
  loopCutActive: false,
  loopCutBaseMesh: null,
  loopCutRingKeys: [],
  loopCutFactor: 0.5,
  loopCutCuts: 1,
  bevelActive: false,
  bevelBaseMesh: null,
  bevelEdgeKeys: [],
  bevelAmount: 0.15,
  bevelSegments: 1,
  knifeActive: false,
  knifeStart: null,
  activeTool: /** @type {ActiveTool} */ ('select'),
  /** Bumped on replaceMesh so viewport geometry/overlays refresh. */
  meshRevision: 0,
  /** Lightweight tick for in-place mesh edits during interactive transform drag. */
  interactiveMeshTick: 0,
  /** True while a viewport marquee drag is in progress (disables orbit). */
  marqueeActive: false,
  /**
   * Live camera/canvas handles per viewport slot (for DOM marquee picking).
   * @type {Record<string, { camera: import('three').Camera, width: number, height: number, canvas: HTMLCanvasElement }>}
   */
  viewportHandles: {},
  /** @type {{ id: number, slotIds: string[], action: 'center' | 'reset', scope?: 'selection' | 'scene' } | null} */
  viewportCameraRequest: null,
  /** True while vertices are being dragged (plane or gizmo). */
  vertexManipActive: false,
  /** @type {VertexManipSession | null} */
  vertexManipSession: null,
  /** Blender-style Shift+S / Shift+R mouse transform session. */
  interactiveTransformActive: false,
  /** @type {'scale' | 'rotate' | null} */
  interactiveTransformMode: null,
  /** @type {import('../lib/scene/objectInteractiveTransform.js').ReturnType<typeof captureObjectInteractiveSession>} */
  objectInteractiveSession: null,
  /** True while object/vertex TransformControls handles pointer (avoids mistaken deselect). */
  gizmoInteracting: false,
  canUndo: false,
  canRedo: false,
  sceneDirty: false,
  themeId: readStoredThemeId(),
  /** @type {{ title: string, message: string, yesLabel: string, noLabel: string, resolve: (value: boolean) => void } | null} */
  confirmDialog: null,
  uvEditorOpen: false,
  pixelEditorOpen: false,
  pixelPaintOnModel: true,
  pixelPaintTargetId: null,
  pixelTool: 'brush',
  pixelFillEnabled: true,
  pixelColor: '#ff7a36',
  pixelBrushSize: 3,
  pixelOpacity: 1,

  setStatus: (statusMessage) => set({ statusMessage }),

  newScene: () => {
    textureCanvasCache.clear();
    textureSyncScheduled.clear();
    texturePreviewScheduled.clear();
    textureCompositeTokens.clear();
    undoStack.clear();
    set({
      objects: [],
      selectedId: null,
      selectedIds: [],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      objectClipboard: null,
      pixelPaintTargetId: null,
      referenceImagesByView: {},
      uvEditorOpen: false,
      pixelEditorOpen: false,
      ...inactiveToolState(),
      meshRevision: get().meshRevision + 1,
      canUndo: false,
      canRedo: false,
      sceneDirty: false,
      statusMessage: 'New scene',
    });
  },

  markSceneSaved: () => set({ sceneDirty: false }),

  setTheme: (themeId) => {
    persistThemeId(themeId);
    set({ themeId, statusMessage: `Theme: ${themeLabel(themeId)}` });
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        set({ paintColor: getThemeMaterialDefault() });
      });
    }
  },

  /**
   * @param {{ title?: string, message?: string, yesLabel?: string, noLabel?: string }} options
   * @returns {Promise<boolean>}
   */
  requestConfirm: (options) =>
    new Promise((resolve) => {
      set({
        confirmDialog: {
          title: options.title ?? 'Confirm',
          message: options.message ?? '',
          yesLabel: options.yesLabel ?? 'Yes',
          noLabel: options.noLabel ?? 'No',
          resolve,
        },
      });
    }),

  answerConfirm: (confirmed) => {
    const dialog = get().confirmDialog;
    if (!dialog) return;
    dialog.resolve(confirmed);
    set({ confirmDialog: null });
  },

  loadProjectState: (projectState) => {
    textureCanvasCache.clear();
    textureSyncScheduled.clear();
    texturePreviewScheduled.clear();
    textureCompositeTokens.clear();
    undoStack.clear();
    const objects = projectState.objects ?? [];
    const selectedId = projectState.selectedId ?? null;
    const selectedIds =
      Array.isArray(projectState.selectedIds) && projectState.selectedIds.length > 0
        ? projectState.selectedIds
        : selectedId
          ? [selectedId]
          : [];
    set({
      objects,
      selectedId,
      selectedIds,
      editMode: projectState.editMode ?? 'object',
      transformMode: projectState.transformMode ?? 'translate',
      gizmoAxisLock: projectState.gizmoAxisLock ?? null,
      selectedVertices: projectState.selectedVertices ?? [],
      selectedEdges: projectState.selectedEdges ?? [],
      selectedFaces: projectState.selectedFaces ?? [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      objectClipboard: null,
      paintColor: projectState.paintColor ?? DEFAULT_PAINT_COLOR,
      renderMode: projectState.renderMode ?? 'textured',
      viewportLayoutMode: projectState.viewportLayoutMode ?? 'quad',
      referenceImagesByView: projectState.referenceImagesByView ?? {},
      snapGrid: !!projectState.snapGrid,
      gridSize: projectState.gridSize ?? 1,
      weldThreshold: projectState.weldThreshold ?? 0.08,
      snapToMeshFeatures: !!projectState.snapToMeshFeatures,
      showWireframe: !!projectState.showWireframe,
      showNormals: !!projectState.showNormals,
      showXRay: !!projectState.showXRay,
      showGrid: projectState.showGrid !== false,
      activeViewport: projectState.activeViewport ?? 'perspective',
      uvEditorOpen: false,
      pixelEditorOpen: false,
      pixelPaintTargetId: null,
      ...inactiveToolState(),
      meshRevision: get().meshRevision + 1,
      canUndo: false,
      canRedo: false,
      sceneDirty: false,
      statusMessage: `Project loaded (${objects.length} object${objects.length === 1 ? '' : 's'})`,
    });
    if (projectState.themeId) get().setTheme(projectState.themeId);
  },

  importSceneObjects: (sceneObjects) => {
    if (!sceneObjects?.length) {
      set({ statusMessage: 'No objects found in import' });
      return;
    }
    const importedObjects = sceneObjects.map((object) => ({
      ...object,
      meshModifiers: object.meshModifiers ?? { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
    }));
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, ...importedObjects],
      selectedId: importedObjects[0].id,
      selectedIds: [importedObjects[0].id],
      editMode: 'object',
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      meshRevision: s.meshRevision + 1,
      statusMessage: `Imported ${importedObjects.length} object(s)`,
    }));
  },

  openUvEditor: () => set({ uvEditorOpen: true, statusMessage: 'UV editor opened' }),
  closeUvEditor: () => set({ uvEditorOpen: false, statusMessage: 'UV editor closed' }),
  openPixelEditor: () =>
    set((s) => ({
      pixelEditorOpen: true,
      editMode: 'object',
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      transformMode: s.transformMode,
      statusMessage: 'Pixel editor opened (Object mode)',
    })),
  closePixelEditor: () =>
    set({ pixelEditorOpen: false, pixelPaintTargetId: null, statusMessage: 'Pixel editor closed' }),
  setPixelPaintOnModel: (pixelPaintOnModel) => set({ pixelPaintOnModel }),
  setPixelPaintTargetId: (pixelPaintTargetId) => set({ pixelPaintTargetId }),
  setPixelTool: (pixelTool) => set({ pixelTool }),
  setPixelFillEnabled: (pixelFillEnabled) =>
    set((s) => ({
      pixelFillEnabled,
      pixelTool: !pixelFillEnabled && s.pixelTool === 'fill' ? 'brush' : s.pixelTool,
    })),
  setPixelColor: (pixelColor) => set({ pixelColor }),
  setPixelBrushSize: (pixelBrushSize) => set({ pixelBrushSize }),
  setPixelOpacity: (pixelOpacity) => set({ pixelOpacity: Math.max(0, Math.min(1, pixelOpacity)) }),

  setObjectTexturePreviewCanvas: (id, canvas, statusMessage = 'Painting texture') => {
    if (!canvas) return;
    const cached = textureCanvasCache.get(id);
    textureCanvasCache.set(id, { dataUrl: cached?.dataUrl ?? null, canvas });
    textureCompositeTokens.set(id, (textureCompositeTokens.get(id) ?? 0) + 1);
    scheduleObjectTextureRevision(set, id, statusMessage);
  },

  setObjectTexture: (id, textureDataUrl, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    textureCanvasCache.delete(id);
    textureSyncScheduled.delete(id);
    texturePreviewScheduled.delete(id);
    textureCompositeTokens.set(id, (textureCompositeTokens.get(id) ?? 0) + 1);
    const textureLayers = textureDataUrl
      ? [{
          id: `texture_layer_${Date.now().toString(36)}`,
          name: 'Texture',
          visible: true,
          opacity: 1,
          kind: 'image',
          dataUrl: textureDataUrl,
        }]
      : [];
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id
        ? { ...o, textureDataUrl, textureLayers, textureRevision: (o.textureRevision ?? 0) + 1 }
        : o)),
      statusMessage: textureDataUrl ? 'Texture image loaded' : 'Texture image cleared',
    }));
  },

  setObjectTextureLayers: (id, textureLayers, textureDataUrl = null, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    textureCanvasCache.delete(id);
    textureSyncScheduled.delete(id);
    texturePreviewScheduled.delete(id);
    const token = (textureCompositeTokens.get(id) ?? 0) + 1;
    textureCompositeTokens.set(id, token);
    const normalized = normalizeTextureLayers(textureLayers);
    set((s) => ({
      objects: s.objects.map((o) => (
        o.id === id
          ? {
              ...o,
              textureLayers: normalized,
              textureDataUrl: textureDataUrl ?? o.textureDataUrl ?? null,
              textureRevision: (o.textureRevision ?? 0) + 1,
            }
          : o
      )),
      statusMessage: normalized.length > 0 ? 'Texture layers updated' : 'Texture image cleared',
    }));
    compositeTextureLayers(normalized).then((compositeDataUrl) => {
      if (textureCompositeTokens.get(id) !== token) return;
      const latest = get().objects.find((o) => o.id === id);
      if (!latest) return;
      set((s) => ({
        objects: s.objects.map((o) => (
          o.id === id ? { ...o, textureDataUrl: compositeDataUrl, textureRevision: (o.textureRevision ?? 0) + 1 } : o
        )),
      }));
    });
  },

  setObjectImageTextureLayer: (id, dataUrl, options = {}) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj) return;
    const current = normalizeTextureLayers(obj.textureLayers?.length ? obj.textureLayers : obj.textureDataUrl
      ? [{
          id: `texture_layer_${Date.now().toString(36)}`,
          name: 'Texture',
          visible: true,
          opacity: 1,
          kind: 'image',
          dataUrl: obj.textureDataUrl,
        }]
      : []);
    const imageIndex = current.findIndex((layer) => layer.kind === 'image');
    const imageLayer = {
      id: imageIndex >= 0 ? current[imageIndex].id : `texture_layer_${Date.now().toString(36)}`,
      name: imageIndex >= 0 ? current[imageIndex].name : 'Texture',
      visible: true,
      opacity: imageIndex >= 0 ? current[imageIndex].opacity : 1,
      kind: 'image',
      dataUrl,
    };
    const next = imageIndex >= 0 ? [...current] : [imageLayer, ...current];
    if (imageIndex >= 0) next[imageIndex] = imageLayer;
    if (!next.some((layer) => layer.kind === 'paint')) {
      next.push({
        id: `paint_layer_${Date.now().toString(36)}`,
        name: 'Paint',
        visible: true,
        opacity: 1,
        kind: 'paint',
        dataUrl: null,
      });
    }
    get().setObjectTextureLayers(id, next, dataUrl, options);
  },

  paintObjectTextureAtUv: (id, u, v, options = {}) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj || obj.isGroup) return;
    getTextureCanvas(id, obj.textureDataUrl, (canvas) => {
      paintTextureDab(canvas, u, v, options);
      scheduleTextureDataUrlSync(id, canvas, set, get);
    });
  },

  paintObjectTextureStroke: (id, fromU, fromV, toU, toV, options = {}) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj || obj.isGroup) return;
    getTextureCanvas(id, obj.textureDataUrl, (canvas) => {
      paintTextureStroke(canvas, fromU, fromV, toU, toV, options);
      scheduleTextureDataUrlSync(id, canvas, set, get);
    });
  },

  paintObjectTextureFace: (id, faceIndex, options = {}) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj || obj.isGroup || !obj.mesh || !obj.mesh.faces[faceIndex]) return;
    const { color = '#ff7a36', erase = false, opacity = 1 } = options;
    const faceUVs = obj.mesh.faceUVs?.[faceIndex];
    if (!faceUVs || faceUVs.length < 3) return;
    getTextureCanvas(id, obj.textureDataUrl, (canvas) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const points = faceUVs.map(([u, v]) => [
        Math.round(Math.max(0, Math.min(1, u)) * (canvas.width - 1)),
        Math.round((1 - Math.max(0, Math.min(1, v))) * (canvas.height - 1)),
      ]);
      if (points.length < 3) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
      if (erase) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
      } else {
        const rgba = parseHexColor(color);
        ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, 1)`;
      }
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      scheduleTextureDataUrlSync(id, canvas, set, get);
    });
  },

  updateFaceUVs: (id, faceUVUpdates, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    set((s) => ({
      objects: s.objects.map((o) => {
        if (o.id !== id || !o.mesh) return o;
        const mesh = o.mesh.clone();
        for (const [faceIndexText, uvs] of Object.entries(faceUVUpdates)) {
          const faceIndex = Number(faceIndexText);
          if (!Number.isInteger(faceIndex) || !mesh.faces[faceIndex]) continue;
          mesh.faceUVs[faceIndex] = uvs.map((uv) => [
            Math.max(-10, Math.min(10, uv[0])),
            Math.max(-10, Math.min(10, uv[1])),
          ]);
        }
        return { ...o, mesh };
      }),
      meshRevision: s.meshRevision + 1,
      statusMessage: 'UVs updated',
    }));
  },

  /** @deprecated Use vertexManipActive / beginVertexManip — kept for minimal churn */
  setVertexGizmoDragging: (active) => {
    if (!active) get().endVertexManip();
    else if (!get().vertexManipActive) set({ vertexManipActive: true });
  },

  beginVertexManip: ({
    objectId,
    vertexIndices,
    kind,
    sourceViewId = null,
  }) => {
    const obj = get().objects.find((o) => o.id === objectId);
    if (!obj?.mesh || vertexIndices.length === 0) return;

    const startPositions = captureVertexPositions(obj.mesh, vertexIndices);
    const startCentroidLocal = vertexCentroid(obj.mesh, vertexIndices);

    set({
      vertexManipActive: true,
      vertexManipSession: {
        objectId,
        sourceViewId,
        kind,
        vertexIndices: [...vertexIndices],
        startPositions,
        startCentroidLocal,
        historyCommitted: false,
      },
    });
  },

  applyVertexManipDelta: (delta) => {
    const session = get().vertexManipSession;
    if (!session) return;

    const obj = get().objects.find((o) => o.id === session.objectId);
    if (!obj?.mesh) return;

    const { snapGrid, gridSize } = get();
    const vertexSnap = vertexSnapParams(snapGrid, gridSize);
    const snapped = snapVertexDelta(delta, vertexSnap.enabled, vertexSnap.grid);
    if (snapped[0] === 0 && snapped[1] === 0 && snapped[2] === 0) return;

    if (!session.historyCommitted) {
      get().pushHistory();
      set((s) => ({
        vertexManipSession: s.vertexManipSession
          ? { ...s.vertexManipSession, historyCommitted: true }
          : null,
      }));
    }

    const next = meshWithVertexDelta(
      obj.mesh,
      session.vertexIndices,
      session.startPositions,
      snapped,
    );
    get().replaceMesh(session.objectId, next, { skipHistory: true });
  },

  applyVertexManipPositions: (positions, options = {}) => {
    const session = get().vertexManipSession;
    if (!session) return;

    const obj = get().objects.find((o) => o.id === session.objectId);
    if (!obj?.mesh || positions.length !== session.vertexIndices.length) return;

    if (!options.skipHistory && !session.historyCommitted) {
      get().pushHistory();
      set((s) => ({
        vertexManipSession: s.vertexManipSession
          ? { ...s.vertexManipSession, historyCommitted: true }
          : null,
      }));
    }

    const silent = options.silent ?? get().interactiveTransformActive;
    if (silent && get().interactiveTransformActive) {
      applyPositionsToMeshInPlace(obj.mesh, session.vertexIndices, positions);
      set((s) => ({ interactiveMeshTick: s.interactiveMeshTick + 1 }));
      return;
    }

    const next = meshWithVertexPositions(obj.mesh, session.vertexIndices, positions);
    get().replaceMesh(session.objectId, next, { skipHistory: true, silent });
  },

  startInteractiveTransform: (mode) => {
    const state = get();
    const statusHint =
      mode === 'scale'
        ? 'Scale — drag along pivot line · X/Y/Z axis · Shift precision · scroll nudge · click confirm · Esc cancel'
        : 'Rotate — drag around pivot · click to confirm · Esc to cancel';

    if (state.editMode === 'object') {
      const objectSession = captureObjectInteractiveSession(
        state.objects,
        coalesceSelectedIds(state),
      );
      if (!objectSession) return;

      get().pushHistory();
      set({
        interactiveTransformActive: true,
        interactiveTransformMode: mode,
        transformMode: mode,
        objectInteractiveSession: objectSession,
        vertexManipActive: false,
        vertexManipSession: null,
        statusMessage: statusHint,
      });
      return;
    }

    const vertexIndices = resolveSubObjectTransformVertices(state);
    if (!state.selectedId || vertexIndices.length === 0) return;

    get().pushHistory();
    get().beginVertexManip({
      objectId: state.selectedId,
      vertexIndices,
      kind: 'interactive',
      sourceViewId: null,
    });

    const session = get().vertexManipSession;
    if (!session) return;

    const obj = get().objects.find((o) => o.id === session.objectId);
    const startPivotWorld = obj
      ? localToWorld(session.startCentroidLocal, obj, get().objects)
      : session.startCentroidLocal;

    set({
      interactiveTransformActive: true,
      interactiveTransformMode: mode,
      transformMode: mode,
      objectInteractiveSession: null,
      vertexManipSession: { ...session, historyCommitted: true, startPivotWorld },
      statusMessage: statusHint,
    });
  },

  updateInteractiveTransform: ({
    scaleFactor = 1,
    scaleFactors = null,
    angleRad = 0,
    axis = [0, 1, 0],
    axisWorld = null,
  }) => {
    const mode = get().interactiveTransformMode;
    if (!mode) return;

    const axisLock = get().gizmoAxisLock;
    const resolvedScaleFactors =
      scaleFactors ?? scaleFactorsFromAxisLock(axisLock, scaleFactor);

    const objectSession = get().objectInteractiveSession;
    if (objectSession) {
      const rotateAxis = axisWorld ?? axis;
      const nextObjects = applyObjectInteractiveTransform(get().objects, objectSession, {
        mode,
        scaleFactor,
        scaleFactors: resolvedScaleFactors,
        angleRad,
        axisWorld: rotateAxis,
      });
      set({ objects: nextObjects });
      return;
    }

    const session = get().vertexManipSession;
    if (!session || session.kind !== 'interactive') return;

    const obj = get().objects.find((o) => o.id === session.objectId);
    if (!obj?.mesh) return;

    const positions =
      mode === 'scale'
        ? scalePositionsInViewSpace(
            session.startPositions,
            session.startCentroidLocal,
            obj,
            get().objects,
            resolvedScaleFactors ?? scaleFactor,
            session.startPivotWorld ?? null,
          )
        : rotatePositionsInViewSpace(
            session.startPositions,
            session.startCentroidLocal,
            obj,
            get().objects,
            axisWorld ?? axis,
            angleRad,
            session.startPivotWorld ?? null,
          );

    get().applyVertexManipPositions(positions, { skipHistory: true });
  },

  confirmInteractiveTransform: () => {
    if (!get().interactiveTransformActive) return;
    const mode = get().interactiveTransformMode;
    if (get().objectInteractiveSession) {
      set({
        interactiveTransformActive: false,
        interactiveTransformMode: null,
        objectInteractiveSession: null,
        gizmoAxisLock: null,
        statusMessage: mode === 'scale' ? 'Object scale applied' : 'Object rotation applied',
      });
      return;
    }

    const session = get().vertexManipSession;
    if (session?.kind === 'interactive') {
      const obj = get().objects.find((o) => o.id === session.objectId);
      if (obj?.mesh) {
        get().replaceMesh(session.objectId, obj.mesh.clone(), { skipHistory: true });
      }
    }

    set({
      vertexManipActive: false,
      vertexManipSession: null,
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      objectInteractiveSession: null,
      gizmoAxisLock: null,
      interactiveMeshTick: 0,
      statusMessage: mode === 'scale' ? 'Scale applied' : 'Rotation applied',
    });
  },

  cancelInteractiveTransform: () => {
    if (!get().interactiveTransformActive) return;

    const objectSession = get().objectInteractiveSession;
    if (objectSession) {
      set((s) => ({
        objects: s.objects.map((o) => {
          const entry = objectSession.entries[o.id];
          if (!entry) return o;
          return {
            ...o,
            position: [...entry.position],
            rotation: [...entry.rotation],
            scale: [...entry.scale],
          };
        }),
        interactiveTransformActive: false,
        interactiveTransformMode: null,
        objectInteractiveSession: null,
        gizmoAxisLock: null,
        interactiveMeshTick: 0,
        statusMessage: 'Transform cancelled',
      }));
      return;
    }

    get().cancelVertexManip();
    set({
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      gizmoAxisLock: null,
      interactiveMeshTick: 0,
      statusMessage: 'Transform cancelled',
    });
  },

  endVertexManip: () => {
    set({
      vertexManipActive: false,
      vertexManipSession: null,
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      objectInteractiveSession: null,
      interactiveMeshTick: 0,
    });
  },

  cancelVertexManip: () => {
    const session = get().vertexManipSession;
    const wasInteractive = get().interactiveTransformActive;
    if (!session) {
      set({
        vertexManipActive: false,
        vertexManipSession: null,
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      objectInteractiveSession: null,
      interactiveMeshTick: 0,
    });
    return;
  }

  const obj = get().objects.find((o) => o.id === session.objectId);
  if (!obj?.mesh) {
    set({
      vertexManipActive: false,
      vertexManipSession: null,
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      objectInteractiveSession: null,
      interactiveMeshTick: 0,
        statusMessage: wasInteractive ? 'Transform cancelled' : 'Move cancelled',
      });
      return;
    }

    const mesh = meshWithVertexPositions(obj.mesh, session.vertexIndices, session.startPositions);
    set((s) => ({
      objects: s.objects.map((o) => (o.id === session.objectId && o.mesh ? { ...o, mesh } : o)),
      meshRevision: s.meshRevision + 1,
      vertexManipActive: false,
      vertexManipSession: null,
      interactiveTransformActive: false,
      interactiveTransformMode: null,
      objectInteractiveSession: null,
      interactiveMeshTick: 0,
      statusMessage: wasInteractive ? 'Transform cancelled' : 'Move cancelled',
    }));
  },

  pushHistory: () => {
    undoStack.push(captureHistoryState(get()));
    set({ canUndo: undoStack.canUndo(), canRedo: undoStack.canRedo(), sceneDirty: true });
  },

  undo: () => {
    const snap = undoStack.undo(captureHistoryState(get()));
    if (!snap) return;
    clearAllTextureCaches();
    set((s) => {
      const wasPolyDraw = isPolyDrawEngaged(s);
      const next = {
        ...applyHistorySnapshot(snap),
        ...inactiveToolState(),
        meshRevision: s.meshRevision + 1,
        canUndo: undoStack.canUndo(),
        canRedo: undoStack.canRedo(),
        statusMessage: 'Undo',
      };
      if (wasPolyDraw) {
        next.editMode = 'object';
        next.transformMode = 'translate';
        next.gizmoAxisLock = null;
        next.selectedVertices = [];
        next.selectedEdges = [];
        next.selectedFaces = [];
        next.hoveredFace = null;
        next.hoveredVertex = null;
        next.hoveredEdge = null;
      }
      return next;
    });
  },

  redo: () => {
    const snap = undoStack.redo(captureHistoryState(get()));
    if (!snap) return;
    clearAllTextureCaches();
    set((s) => {
      const wasPolyDraw = isPolyDrawEngaged(s);
      const next = {
        ...applyHistorySnapshot(snap),
        ...inactiveToolState(),
        meshRevision: s.meshRevision + 1,
        canUndo: undoStack.canUndo(),
        canRedo: undoStack.canRedo(),
        statusMessage: 'Redo',
      };
      if (wasPolyDraw) {
        next.editMode = 'object';
        next.transformMode = 'translate';
        next.gizmoAxisLock = null;
        next.selectedVertices = [];
        next.selectedEdges = [];
        next.selectedFaces = [];
        next.hoveredFace = null;
        next.hoveredVertex = null;
        next.hoveredEdge = null;
      }
      return next;
    });
  },

  clearAllSelection: () =>
    set((s) => ({
      selectedId: null,
      selectedIds: [],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      ...normalizeStrandedEditMode({ ...s, selectedId: null, selectedIds: [] }),
      statusMessage: 'Selection cleared',
    })),

  setActiveViewport: (activeViewport) => set({ activeViewport }),

  setActiveViewportSlot: (activeViewportSlot) => set({ activeViewportSlot }),

  /** @param {{ slotIds: string[], action: 'center' | 'reset', scope?: 'selection' | 'scene' }} payload */
  requestViewportCamera: (payload) =>
    set({
      viewportCameraRequest: {
        id: Date.now(),
        scope: 'selection',
        ...payload,
      },
    }),

  centerActiveViewport: (scope = 'selection') => {
    const { activeViewportSlot } = get();
    get().requestViewportCamera({ slotIds: [activeViewportSlot], action: 'center', scope });
    set({
      statusMessage:
        scope === 'scene'
          ? 'Centered active viewport on scene'
          : 'Centered active viewport on selection',
    });
  },

  resetActiveViewport: () => {
    const { activeViewportSlot } = get();
    get().requestViewportCamera({ slotIds: [activeViewportSlot], action: 'reset' });
    set({ statusMessage: 'Reset active viewport camera' });
  },

  resetAllViewports: () => {
    get().requestViewportCamera({ slotIds: ['a', 'b', 'c', 'd'], action: 'reset' });
    set({ statusMessage: 'Reset all viewport cameras' });
  },

  /** @param {'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'} arrow @param {{ shiftKey?: boolean }} [options] */
  nudgeSelectionByArrow: (arrow, options = {}) => {
    const state = get();
    if (isInteractionBlocked(state)) return;

    const handle = state.viewportHandles[state.activeViewportSlot];
    if (!handle?.camera) {
      set({ statusMessage: 'Click a viewport first to nudge along its axes' });
      return;
    }

    const step = nudgeStepForMode(state.editMode, state.snapGrid, state.gridSize, {
      shiftKey: options.shiftKey,
    });
    const worldDelta = arrowWorldDelta(handle.camera, arrow, step, {
      viewId: state.activeViewport,
      axisLock: state.gizmoAxisLock,
    });
    if (worldDelta.every((v) => v === 0)) return;

    if (state.editMode === 'object') {
      const ids = coalesceSelectedIds(state).filter((id) => {
        const obj = state.objects.find((o) => o.id === id);
        return obj && !obj.locked;
      });
      if (ids.length === 0) {
        set({ statusMessage: 'Select an object to nudge' });
        return;
      }
      get().pushHistory();
      const objects = get().objects;
      for (const id of ids) {
        const obj = objects.find((o) => o.id === id);
        if (!obj) continue;
        const position = nudgedObjectPosition(obj, objects, worldDelta);
        get().updateObject(id, { position }, { skipHistory: true });
      }
      set({ statusMessage: `Nudged ${ids.length === 1 ? 'object' : `${ids.length} objects`}` });
      return;
    }

    const { selectedId, objects, selectedVertices, selectedEdges, selectedFaces } = state;
    if (!selectedId) {
      set({ statusMessage: 'Select a mesh (object mode) then switch to vertex/edge/face' });
      return;
    }

    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh || obj.isGroup) {
      set({ statusMessage: 'Select a mesh object to nudge vertices, edges, or faces' });
      return;
    }

    const vertexIndices =
      state.editMode === 'vertex'
        ? selectedVertices
        : state.editMode === 'edge'
          ? verticesFromEdgeKeys(selectedEdges)
          : state.editMode === 'face'
            ? verticesFromFaceIndices(obj.mesh, selectedFaces)
            : [];

    const unique = [...new Set(vertexIndices)].filter((vi) => vi >= 0 && vi < obj.mesh.vertexCount);
    if (unique.length === 0) {
      set({ statusMessage: 'Select vertices, edges, or faces to nudge' });
      return;
    }

    const vertexSnap = vertexSnapParams(state.snapGrid, state.gridSize);
    let delta = worldDelta;
    if (vertexSnap.enabled) {
      delta = [
        Math.round(delta[0] / vertexSnap.grid) * vertexSnap.grid,
        Math.round(delta[1] / vertexSnap.grid) * vertexSnap.grid,
        Math.round(delta[2] / vertexSnap.grid) * vertexSnap.grid,
      ];
    }

    get().pushHistory();
    const mesh = nudgeMeshVerticesWorld(obj.mesh, unique, obj, objects, delta);
    get().replaceMesh(selectedId, mesh, { skipHistory: true });
    set({
      statusMessage: `Nudged ${unique.length === 1 ? '1 vertex' : `${unique.length} vertices`}`,
    });
  },
  setRenderMode: (renderMode) =>
    set({
      renderMode,
      statusMessage: `Render mode: ${renderMode}`,
    }),
  setViewportLayoutMode: (viewportLayoutMode) =>
    set({
      viewportLayoutMode,
      statusMessage: `Viewport layout: ${viewportLayoutMode}`,
    }),

  startPrimitiveDraw: (type) => {
    get().cancelPolyDraw();
    get().cancelExtrudeSession();
    get().cancelBevelSession();
    get().cancelKnifeTool();
    set({
      activeTool: 'primitiveDraw',
      pendingPrimitive: type,
      drawPhase: 'idle',
      drawStart: null,
      drawCorner2: null,
      drawHeight: DEFAULT_HEIGHT,
      drawViewId: null,
      drawRevision: 0,
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      statusMessage: `Draw ${type}: click in a viewport and drag footprint`,
    });
  },

  cancelPrimitiveDraw: () =>
    set({
      activeTool: 'select',
      pendingPrimitive: null,
      drawPhase: 'idle',
      drawStart: null,
      drawCorner2: null,
      drawHeight: DEFAULT_HEIGHT,
      drawViewId: null,
      drawRevision: 0,
      statusMessage: 'Draw cancelled',
    }),

  beginWidthDrag: (point, viewId) => {
    const grid = get().snapGrid ? get().gridSize : 0;
    const p = snapPoint(point, grid);
    set((s) => ({
      activeViewport: viewId,
      drawPhase: 'width',
      drawStart: copyVec3(p),
      drawCorner2: copyVec3(p),
      drawViewId: viewId,
      drawHeight: DEFAULT_HEIGHT,
      drawRevision: s.drawRevision + 1,
      statusMessage: 'Dragging footprint — release LMB for height',
    }));
  },

  updateWidthDrag: (point) => {
    const state = get();
    const { drawPhase, drawStart, drawViewId, snapGrid, gridSize } = state;
    if (drawPhase !== 'width' || !drawStart || !drawViewId) return;
    const grid = snapGrid ? gridSize : 0;
    const onPlane = projectToDrawPlane(point, drawViewId, drawStart);
    const drawCorner2 = snapPoint(onPlane, grid);
    const { min, max } = buildBoxFromDraw(drawStart, drawCorner2, 0.02, drawViewId);
    const label = formatDrawSize(boxMetrics(min, max).size);
    set((s) => ({
      drawCorner2,
      drawRevision: s.drawRevision + 1,
      statusMessage: `Footprint: ${label} — release LMB for height`,
    }));
  },

  endWidthDrag: () => {
    const { drawPhase, drawStart, drawCorner2 } = get();
    if (drawPhase !== 'width' || !drawStart) return;
    const corner = drawCorner2 ? copyVec3(drawCorner2) : copyVec3(drawStart);
    set((s) => ({
      drawPhase: 'height',
      drawCorner2: corner,
      drawRevision: s.drawRevision + 1,
      statusMessage: 'Set height (move mouse / scroll wheel) — click to place',
    }));
  },

  setDrawHeight: (height) => {
    if (get().drawPhase !== 'height') return;
    set((s) => {
      const next = { ...s, drawHeight: height };
      return {
        drawHeight: height,
        drawRevision: s.drawRevision + 1,
        statusMessage: drawHeightStatus(next, height),
      };
    });
  },

  adjustDrawHeight: (delta) => {
    if (get().drawPhase !== 'height') return;
    set((s) => {
      const drawHeight = s.drawHeight + delta;
      const next = { ...s, drawHeight };
      return {
        drawHeight,
        drawRevision: s.drawRevision + 1,
        statusMessage: drawHeightStatus(next, drawHeight),
      };
    });
  },

  setPolyFaceMode: (polyFaceMode) =>
    set({
      polyFaceMode,
      polyDrawVerts: [],
      statusMessage:
        polyFaceMode === 'poly'
          ? 'Poly draw set to polygon fill — Enter or click first point to fill'
          : `Poly draw set to ${polyFaceMode} faces`,
    }),

  startPolyDraw: () => {
    get().cancelPrimitiveDraw();
    get().cancelExtrudeSession();
    get().cancelBevelSession();
    get().cancelKnifeTool();
    if (isPolyDrawEngaged(get()) || get().polyDrawTargetId) {
      get().cancelPolyDraw();
    }
    const stranded = normalizeStrandedEditMode(get());
    if (Object.keys(stranded).length > 0) {
      set(stranded);
    }
    const { objects, selectedId } = get();
    const selectedObject = objects.find((o) => o.id === selectedId && o.mesh && !o.isGroup && !o.locked);
    const continuingObject = !!selectedObject;
    const targetId = selectedObject?.id ?? uid();
    let nextObjects = objects;
    let baseMesh = selectedObject?.mesh?.clone() ?? null;

    if (!continuingObject) {
      const mesh = new EditableMesh({ name: 'PolyMesh', positions: [], faces: [] });
      nextObjects = [
        ...objects,
        {
          id: targetId,
          name: `PolyMesh_${objects.length + 1}`,
          parentId: null,
          isGroup: false,
          mesh,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureDataUrl: null,
          textureLayers: [],
          textureRevision: 0,
          meshModifiers: { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
          visible: true,
          locked: false,
        },
      ];
      baseMesh = mesh.clone();
      get().pushHistory();
    }

    const mode = get().polyFaceMode;
    const needed = polyFacePointCount(mode);
    set({
      objects: nextObjects,
      activeTool: 'polyDraw',
      polyDrawActive: true,
      polyDrawVerts: [],
      polyDrawTargetId: targetId,
      polyDrawCreatedObject: !continuingObject,
      polyDrawRevertOnCancel: continuingObject,
      polyDrawAnchor: null,
      polyDrawBaseMesh: baseMesh,
      selectedId: targetId,
      selectedIds: targetId ? [targetId] : [],
      editMode: 'vertex',
      transformMode: 'translate',
      gizmoAxisLock: null,
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      vertexManipActive: false,
      vertexManipSession: null,
      marqueeActive: false,
      pendingPrimitive: null,
      statusMessage: needed
        ? continuingObject
          ? `Poly draw on — click ${needed} points per ${mode} face (Esc to finish)`
          : `Poly draw on — click ${needed} points for first ${mode} face (Esc to finish)`
        : continuingObject
          ? 'Poly draw on — add vertices, Enter or click first point to fill (Esc to finish)'
          : 'Poly draw on — draw a polygon, Enter or click first point to fill (Esc to finish)',
    });
  },

  finalizePolyDrawSession: () => {
    const s = get();
    if (!isPolyDrawEngaged(s)) return;
    set(polyDrawSessionEndState(s.objects, s));
  },

  cancelPolyDraw: () => {
    const s = get();
    set(polyDrawSessionEndState(s.objects, s));
  },

  undoPolyDrawPoint: () => {
    const { polyDrawVerts } = get();
    if (polyDrawVerts.length === 0) return;
    set({
      polyDrawVerts: polyDrawVerts.slice(0, -1),
      statusMessage: `${polyDrawVerts.length - 1} point(s) in current face`,
    });
  },

  fillPolyDrawFace: () => {
    const { polyDrawActive, polyDrawTargetId, polyDrawVerts, polyDrawCreatedObject, objects, paintColor } = get();
    if (!polyDrawActive || !polyDrawTargetId) return;
    if (polyDrawVerts.length < 3) {
      set({ statusMessage: 'Pick at least 3 vertices to fill a face' });
      return;
    }
    const obj = objects.find((o) => o.id === polyDrawTargetId);
    if (!obj?.mesh) return;
    const mesh = addFace(obj.mesh, polyDrawVerts, paintColor);
    if (mesh.faceCount === obj.mesh.faceCount) {
      set({ statusMessage: 'Face needs distinct vertices' });
      return;
    }
    get().pushHistory();
    const statusMessage = polyDrawFaceCommittedMessage(get().polyFaceMode);
    set((s) => commitPolyDrawMeshState(s, obj.id, mesh, statusMessage, polyDrawCreatedObject));
  },

  addPolyDrawVertex: (index) => {
    const {
      polyDrawActive,
      polyDrawTargetId,
      polyDrawVerts,
      polyFaceMode,
      polyDrawCreatedObject,
      objects,
      paintColor,
    } = get();
    if (!polyDrawActive || !polyDrawTargetId) return;

    const obj = objects.find((o) => o.id === polyDrawTargetId);
    if (!obj?.mesh || index < 0 || index >= obj.mesh.vertexCount) return;

    if (polyFaceMode === 'poly' && polyDrawVerts.length >= 3 && index === polyDrawVerts[0]) {
      get().fillPolyDrawFace();
      return;
    }

    if (polyDrawVerts.includes(index)) {
      set({ statusMessage: 'That vertex is already in the current face' });
      return;
    }

    const verts = [...polyDrawVerts, index];
    const needed = polyFacePointCount(polyFaceMode);

    if (needed && verts.length >= needed) {
      const mesh = addFace(obj.mesh, verts.slice(0, needed), paintColor);
      if (mesh.faceCount === obj.mesh.faceCount) {
        set({
          polyDrawVerts,
          statusMessage: `Pick ${needed} distinct vertices for a ${polyFaceMode}`,
        });
        return;
      }
      get().pushHistory();
      const statusMessage = polyDrawFaceCommittedMessage(get().polyFaceMode);
      set((s) => commitPolyDrawMeshState(s, obj.id, mesh, statusMessage, polyDrawCreatedObject));
      return;
    }

    set({
      polyDrawVerts: verts,
      statusMessage: needed
        ? `${verts.length}/${needed} vertices for ${polyFaceMode}`
        : `${verts.length} polygon vertices — Enter or click first point to fill`,
    });
  },

  /**
   * @param {[number, number, number]} worldPoint
   * @param {import('../components/viewport/viewportConfig.js').ViewportId} viewId
   */
  addPolyDrawPoint: (worldPoint, viewId, options = {}) => {
    const {
      polyDrawActive,
      polyDrawTargetId,
      polyDrawVerts,
      polyFaceMode,
      polyDrawCreatedObject,
      polyDrawAnchor,
      objects,
      snapGrid,
      gridSize,
      paintColor,
    } = get();
    if (!polyDrawActive || !polyDrawTargetId) return;

    const obj = objects.find((o) => o.id === polyDrawTargetId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Poly draw needs a mesh target' });
      return;
    }

    const grid = snapGrid ? gridSize : 0;
    let anchor = polyDrawAnchor;
    if (!anchor) {
      anchor = worldPoint;
      set({ polyDrawAnchor: anchor });
    }
    const onPlane = options.keepWorldPoint
      ? worldPoint
      : projectToDrawPlane(worldPoint, viewId, anchor);
    const snapped = snapPoint(onPlane, grid);
    const local = worldToLocal(snapped, obj);
    const scale = Math.max(obj.scale[0], obj.scale[1], obj.scale[2], 0.001);
    const threshold = 0.06 / scale;

    let mesh = obj.mesh;
    const { mesh: nextMesh, index } = findOrAddVertex(mesh, local, threshold);
    mesh = nextMesh;

    if (polyFaceMode === 'poly' && polyDrawVerts.length >= 3 && index === polyDrawVerts[0]) {
      get().fillPolyDrawFace();
      return;
    }

    if (polyDrawVerts.includes(index)) {
      set({ statusMessage: 'That vertex is already in the current face' });
      return;
    }

    const addedVertex = mesh !== obj.mesh;

    const verts = [...polyDrawVerts, index];
    const needed = polyFacePointCount(polyFaceMode);

    if (needed && verts.length >= needed) {
      const faceMesh = addFace(mesh, verts.slice(0, needed), paintColor);
      if (faceMesh.faceCount === mesh.faceCount) {
        get().replaceMesh(polyDrawTargetId, mesh, { skipHistory: true });
        set({
          polyDrawVerts: verts.slice(0, -1),
          statusMessage: `Pick ${needed} distinct vertices for a ${polyFaceMode}`,
        });
        return;
      }
      mesh = faceMesh;
      if (!addedVertex) get().pushHistory();
      else get().pushHistory();
      const statusMessage = polyDrawFaceCommittedMessage(get().polyFaceMode);
      set((s) => commitPolyDrawMeshState(s, obj.id, mesh, statusMessage, polyDrawCreatedObject));
    } else {
      if (addedVertex) {
        get().pushHistory();
        get().replaceMesh(polyDrawTargetId, mesh, { skipHistory: true });
      }
      set({
        polyDrawVerts: verts,
        statusMessage: needed
          ? `${verts.length}/${needed} vertices for ${polyFaceMode}`
          : `${verts.length} polygon vertices — Enter or click first point to fill`,
      });
    }
  },

  finalizeDraw: () => {
    const { pendingPrimitive, drawStart, drawCorner2, drawHeight, drawViewId, objects, paintColor } = get();
    if (!pendingPrimitive || !drawStart || !drawCorner2 || !drawViewId || get().drawPhase !== 'height') return;

    const { min, max } = buildBoxFromDraw(drawStart, drawCorner2, drawHeight, drawViewId);
    const { center, size } = boxMetrics(min, max);
    const mesh = createPrimitiveForDrawView(pendingPrimitive, drawViewId);
    mesh.setUniformFaceColor(paintColor);
    const scale = scaleForBox(pendingPrimitive, size, drawViewId);
    const id = uid();

    get().pushHistory();
    const obj = {
      id,
      name: `${mesh.name}_${objects.length + 1}`,
      parentId: null,
      isGroup: false,
      mesh,
      position: center,
      rotation: [0, 0, 0],
      scale,
      textureDataUrl: null,
      textureLayers: [],
      textureRevision: 0,
      meshModifiers: { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
      visible: true,
      locked: false,
    };

    set({
      objects: [...objects, obj],
      activeTool: 'select',
      selectedId: id,
      selectedIds: [id],
      pendingPrimitive: null,
      drawPhase: 'idle',
      drawStart: null,
      drawCorner2: null,
      drawHeight: DEFAULT_HEIGHT,
      drawViewId: null,
      drawRevision: 0,
      statusMessage: `Placed ${mesh.name}`,
    });
  },

  addPrimitive: (type) => {
    get().pushHistory();
    const mesh = createPrimitive(type);
    mesh.setUniformFaceColor(get().paintColor);
    const id = uid();
    const obj = {
      id,
      name: `${mesh.name}_${get().objects.length + 1}`,
      parentId: null,
      isGroup: false,
      mesh,
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      textureDataUrl: null,
      textureLayers: [],
      textureRevision: 0,
      meshModifiers: { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
      visible: true,
      locked: false,
    };
    set((s) => ({
      objects: [...s.objects, obj],
      selectedId: id,
      selectedIds: [id],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      activeTool: 'select',
      statusMessage: `Added ${mesh.name}`,
    }));
  },

  addGroup: () => {
    get().pushHistory();
    const id = uid();
    const obj = {
      id,
      name: `Group_${get().objects.length + 1}`,
      parentId: null,
      isGroup: true,
      mesh: null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      textureDataUrl: null,
      textureLayers: [],
      textureRevision: 0,
      meshModifiers: { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
      visible: true,
      locked: false,
    };
    set((s) => ({
      objects: [...s.objects, obj],
      selectedId: id,
      selectedIds: [id],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      statusMessage: 'Group added',
    }));
  },

  groupSelectedObjects: () => {
    const { objects } = get();
    const rawIds = filterOutAncestorSelections(objects, coalesceSelectedIds(get()));
    const targets = rawIds
      .map((id) => objects.find((o) => o.id === id))
      .filter((o) => o && !o.locked);

    if (targets.length < 2) {
      set({ statusMessage: 'Shift-click 2+ objects in the Scene list, then Group' });
      return;
    }

    get().pushHistory();
    const groupId = uid();
    const memberIds = new Set(targets.map((o) => o.id));
    const { group, members } = buildGroupedObjects(objects, targets, groupId);

    set({
      objects: [
        ...objects.filter((o) => !memberIds.has(o.id)),
        ...members,
        group,
      ],
      selectedId: groupId,
      selectedIds: [groupId],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      meshRevision: get().meshRevision + 1,
      statusMessage: `Grouped ${targets.length} objects`,
    });
  },

  ungroupSelected: () => {
    const { objects } = get();
    const ids = coalesceSelectedIds(get());
    const groupIds = ids.filter((id) => objects.find((o) => o.id === id)?.isGroup);
    if (groupIds.length === 0) {
      set({ statusMessage: 'Select a group to ungroup' });
      return;
    }

    get().pushHistory();
    let nextObjects = [...objects];
    const releasedIds = [];

    for (const groupId of groupIds) {
      const baked = ungroupChildren(nextObjects, groupId);
      if (baked.length === 0) continue;
      releasedIds.push(...baked.map((o) => o.id));
      const bakedById = new Map(baked.map((o) => [o.id, o]));
      nextObjects = nextObjects
        .filter((o) => o.id !== groupId)
        .map((o) => bakedById.get(o.id) ?? o);
    }

    set({
      objects: nextObjects,
      selectedId: releasedIds[0] ?? null,
      selectedIds: releasedIds,
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      meshRevision: get().meshRevision + 1,
      statusMessage:
        releasedIds.length > 0
          ? `Ungrouped ${releasedIds.length} object${releasedIds.length === 1 ? '' : 's'}`
          : 'Group removed',
    });
  },

  setObjectParent: (id, parentId) => {
    if (id === parentId) return;
    get().pushHistory();
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, parentId } : o)),
    }));
  },

  selectObject: (id, options = {}) => {
    const before = get();
    const preserveEditMode = !!options.preserveEditMode;
    if (!preserveEditMode) {
      if (before.extrudeActive) get().cancelExtrudeSession();
      if (before.loopCutActive) get().cancelLoopCutSession();
      if (before.bevelActive) get().cancelBevelSession();
      if (before.knifeActive || before.knifeStart) get().cancelKnifeTool();
    }
    set((s) => {
      const { selectedIds, selectedId } = nextObjectSelection(
        id,
        { additive: !!options.additive, remove: !!options.remove },
        coalesceSelectedIds(s),
      );
      const endedPolyDraw = isPolyDrawEngaged(s);
      const toolReset = endedPolyDraw ? polyDrawSessionEndState(s.objects, s) : {};
      const keepEditMode =
        (preserveEditMode || endedPolyDraw) && s.editMode !== 'object' && !endedPolyDraw;
      const keepSubSelection =
        keepEditMode && selectedId === s.selectedId && selectedId !== null;
      const next = {
        ...toolReset,
        editMode: endedPolyDraw || !keepEditMode ? 'object' : s.editMode,
        selectedIds,
        selectedId,
        selectedVertices: keepSubSelection ? s.selectedVertices : [],
        selectedEdges: keepSubSelection ? s.selectedEdges : [],
        selectedFaces: keepSubSelection ? s.selectedFaces : [],
        hoveredFace: null,
        hoveredVertex: null,
        hoveredEdge: null,
      };
      return {
        ...next,
        statusMessage: selectedId
          ? statusWithSelection({ ...s, ...next }, 'Selected object')
          : 'Selection cleared',
      };
    });
  },

  selectObjects: (ids, mode = 'replace') =>
    set((s) => {
      const toolReset = isPolyDrawEngaged(s)
        ? polyDrawSessionEndState(s.objects, s)
        : inactiveToolState();
      const { selectedIds, selectedId } = nextObjectSelectionBatch(ids, mode, coalesceSelectedIds(s));
      const next = {
        ...toolReset,
        editMode: 'object',
        selectedIds,
        selectedId,
        selectedVertices: [],
        selectedEdges: [],
        selectedFaces: [],
        hoveredFace: null,
        hoveredVertex: null,
        hoveredEdge: null,
      };
      return {
        ...next,
        statusMessage: selectedId
          ? statusWithSelection({ ...s, ...next }, 'Selected objects')
          : 'Selection cleared',
      };
    }),

  updateObject: (id, patch, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    set((s) => ({
      objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  },
  toggleObjectLock: (id) => {
    get().pushHistory();
    set((s) => {
      const target = s.objects.find((o) => o.id === id);
      if (!target) return {};
      const nextLocked = !target.locked;
      return {
        objects: s.objects.map((o) => (o.id === id ? { ...o, locked: nextLocked } : o)),
        statusMessage: nextLocked ? 'Object locked' : 'Object unlocked',
      };
    });
  },
  addReferenceImage: (viewId, dataUrl, name = 'Reference') => {
    get().pushHistory();
    set((s) => {
      const current = s.referenceImagesByView[viewId] ?? [];
      const nextImage = {
        id: uid(),
        name,
        dataUrl,
        x: 24 + current.length * 18,
        y: 24 + current.length * 18,
        width: 240,
        height: 240,
        rotation: 0,
        opacity: 0.62,
        locked: false,
      };
      return {
        referenceImagesByView: {
          ...s.referenceImagesByView,
          [viewId]: [...current, nextImage],
        },
        statusMessage: `Reference added to ${viewId}`,
      };
    });
  },
  updateReferenceImage: (viewId, imageId, patch, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    set((s) => ({
      referenceImagesByView: {
        ...s.referenceImagesByView,
        [viewId]: (s.referenceImagesByView[viewId] ?? []).map((img) =>
          img.id === imageId ? { ...img, ...patch } : img,
        ),
      },
    }));
  },
  removeReferenceImage: (viewId, imageId) => {
    get().pushHistory();
    set((s) => ({
      referenceImagesByView: {
        ...s.referenceImagesByView,
        [viewId]: (s.referenceImagesByView[viewId] ?? []).filter((img) => img.id !== imageId),
      },
      statusMessage: 'Reference removed',
    }));
  },

  replaceMesh: (id, mesh, options = {}) => {
    if (!options.skipHistory) get().pushHistory();
    set((s) => {
      const next = {
        objects: s.objects.map((o) => (o.id === id && o.mesh ? { ...o, mesh } : o)),
      };
      if (!options.silent) {
        next.meshRevision = s.meshRevision + 1;
        next.statusMessage = statusWithSelection(
          s.selectedId === id ? { ...s, ...sanitizeSubSelectionForMesh(s, mesh) } : s,
          'Mesh updated',
        );
        if (s.selectedId === id) {
          Object.assign(next, sanitizeSubSelectionForMesh(s, mesh));
        }
      }
      return next;
    });
  },

  applyObjectModifiers: (id) => {
    const obj = get().objects.find((o) => o.id === id);
    if (!obj?.mesh || obj.locked) return;
    const evaluated = evaluateObjectMesh(obj);
    if (!evaluated || evaluated === obj.mesh) {
      set({ statusMessage: 'No modifiers to apply' });
      return;
    }
    get().pushHistory();
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id
          ? {
              ...o,
              mesh: evaluated.clone(),
              meshModifiers: { mirrorEnabled: false, mirrorAxis: o.meshModifiers?.mirrorAxis ?? 'x', subdivisionLevel: 0 },
            }
          : o,
      ),
      meshRevision: s.meshRevision + 1,
      statusMessage: 'Modifiers applied',
    }));
  },

  removeSelected: () => {
    const { objects } = get();
    const ids = coalesceSelectedIds(get());
    if (ids.length === 0) return;
    get().pushHistory();
    const removeIds = new Set(ids);
    for (const id of ids) {
      objects.filter((o) => o.parentId === id).forEach((child) => removeIds.add(child.id));
    }
    const n = removeIds.size;
    set({
      objects: objects.filter((o) => !removeIds.has(o.id)),
      selectedId: null,
      selectedIds: [],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      statusMessage: n === 1 ? 'Object deleted' : `${n} objects deleted`,
    });
  },

  duplicateSelected: () => {
    const ids = coalesceSelectedIds(get());
    if (!ids.length) return;
    get().pushHistory();
    const copies = duplicateSubtrees(get().objects, ids);
    const copyIdSet = new Set(copies.map((o) => o.id));
    const rootIds = copies.filter((o) => !o.parentId || !copyIdSet.has(o.parentId)).map((o) => o.id);
    set((s) => ({
      objects: [...s.objects, ...copies],
      selectedId: rootIds[rootIds.length - 1] ?? copies[copies.length - 1].id,
      selectedIds: rootIds.length ? rootIds : [copies[copies.length - 1].id],
      statusMessage: copies.length === 1 ? 'Object duplicated' : `${rootIds.length || 1} object(s) duplicated`,
    }));
  },

  copySelectedObject: () => {
    const snapshots = copySelectionSnapshots(get());
    if (!snapshots?.length) {
      set({ statusMessage: 'Select an object to copy' });
      return;
    }
    set({
      objectClipboard: snapshots,
      statusMessage: `Copied ${snapshots.length} object(s)`,
    });
  },

  pasteClipboardObject: () => {
    const { objectClipboard, objects } = get();
    if (!objectClipboard) {
      set({ statusMessage: 'Clipboard is empty' });
      return;
    }
    if (!Array.isArray(objectClipboard)) {
      get().pushHistory();
      const id = uid();
      const src = objectClipboard;
      const pasted = {
        ...src,
        id,
        name: `${src.name}_copy`,
        parentId: src.parentId,
        mesh: src.mesh ? src.mesh.clone() : null,
        isGroup: src.isGroup,
        position: [src.position[0] + 0.5, src.position[1], src.position[2] + 0.5],
        textureLayers: src.textureLayers?.map((layer) => ({ ...layer })) ?? [],
        textureRevision: 0,
        meshModifiers: src.meshModifiers ? { ...src.meshModifiers } : { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
        locked: false,
      };
      set((s) => ({
        objects: [...s.objects, pasted],
        selectedId: id,
        selectedIds: [id],
        selectedVertices: [],
        selectedEdges: [],
        selectedFaces: [],
        statusMessage: `Pasted ${pasted.name}`,
      }));
      return;
    }
    const snapshots = objectClipboard;
    get().pushHistory();
    const pasted = pasteObjectSnapshots(snapshots);
    const pastedIdSet = new Set(pasted.map((o) => o.id));
    const rootIds = pasted.filter((o) => !o.parentId || !pastedIdSet.has(o.parentId)).map((o) => o.id);
    set((s) => ({
      objects: [...s.objects, ...pasted],
      selectedId: rootIds[rootIds.length - 1] ?? pasted[pasted.length - 1].id,
      selectedIds: rootIds.length ? rootIds : [pasted[pasted.length - 1].id],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      statusMessage: `Pasted ${pasted.length} object(s)`,
    }));
  },

  setEditMode: (editMode) => {
    const s = get();
    if (s.extrudeActive) get().cancelExtrudeSession();
    if (s.loopCutActive) get().cancelLoopCutSession();
    if (s.bevelActive) get().cancelBevelSession();
    set((state) => {
      const toolReset = isPolyDrawEngaged(state)
        ? polyDrawSessionEndState(state.objects, state)
        : {};
      return {
        ...toolReset,
        editMode,
        transformMode: editMode === 'object' ? s.transformMode : 'translate',
        gizmoAxisLock: null,
        selectedVertices: [],
        selectedEdges: [],
        selectedFaces: [],
        hoveredFace: null,
        hoveredVertex: null,
        hoveredEdge: null,
        statusMessage:
          editMode === 'face'
            ? 'Face mode — click to select · Shift+S scale · Shift+R rotate · G move (gizmo) · E extrude · Del delete'
            : editMode === 'edge'
              ? 'Edge mode — LMB select · L loop cut · Shift+L loop · Alt+R ring · Shift+S/R scale/rotate · Del delete faces'
              : editMode === 'vertex'
                ? 'Vertex mode — LMB select · arrows nudge · Shift+arrows fine step · hold Z for depth · G move · Del delete'
                : `${editMode.charAt(0).toUpperCase()}${editMode.slice(1)} mode — LMB select · Shift add/toggle · Ctrl remove · Del delete`,
      };
    });
  },

  setHoveredFace: (hoveredFace) => set({ hoveredFace }),
  setHoveredVertex: (hoveredVertex) => set({ hoveredVertex }),
  setHoveredEdge: (hoveredEdge) => set({ hoveredEdge }),

  setTransformMode: (transformMode) => set({ transformMode, gizmoAxisLock: null }),
  setGizmoAxisLock: (gizmoAxisLock) => set({ gizmoAxisLock }),
  setGizmoInteracting: (gizmoInteracting) => set({ gizmoInteracting }),

  toggleWireframe: () => set((s) => ({ showWireframe: !s.showWireframe })),
  toggleNormals: () =>
    set((s) => ({
      showNormals: !s.showNormals,
      statusMessage: !s.showNormals ? 'Normals visible' : 'Normals hidden',
    })),
  toggleXRay: () =>
    set((s) => ({
      showXRay: !s.showXRay,
      statusMessage: s.showXRay ? 'X-Ray off' : 'X-Ray on',
    })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () =>
    set((s) => ({
      snapGrid: !s.snapGrid,
      statusMessage: s.snapGrid ? 'Snap to grid off' : `Snap to grid on (${s.gridSize})`,
    })),
  setGridSize: (gridSize) => {
    const n = Number(gridSize);
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(0.01, Math.min(100, n));
    const rounded = Math.round(clamped * 1000) / 1000;
    set({
      gridSize: rounded,
      statusMessage: `Grid size: ${rounded}`,
    });
  },

  setPaintColor: (paintColor) => {
    set({ paintColor });
    get().applyPaintToSelection();
  },
  setObjectMaterialColor: (paintColor) => {
    set({ paintColor });
    const { selectedId, objects } = get();
    if (!selectedId) {
      set({ statusMessage: 'Material color set' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh object for material color' });
      return;
    }
    const mesh = obj.mesh.clone();
    mesh.faceColors = mesh.faces.map(() => paintColor);
    get().replaceMesh(selectedId, mesh);
    set({ statusMessage: 'Object material updated' });
  },
  clearMaterialColor: () => {
    const { selectedId, objects, selectedFaces, editMode } = get();
    if (!selectedId) {
      set({ paintColor: '#ffffff', statusMessage: 'No color selected' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ paintColor: '#ffffff', statusMessage: 'Select a mesh object' });
      return;
    }

    const mesh = obj.mesh.clone();
    if (editMode === 'face' && selectedFaces.length > 0) {
      for (const fi of selectedFaces) {
        if (mesh.faceColors[fi] !== undefined) mesh.faceColors[fi] = '#ffffff';
      }
      get().replaceMesh(selectedId, mesh);
      set({ paintColor: '#ffffff', statusMessage: 'Face color cleared' });
      return;
    }

    mesh.faceColors = mesh.faces.map(() => '#ffffff');
    get().replaceMesh(selectedId, mesh);
    set({ paintColor: '#ffffff', statusMessage: 'Object color cleared' });
  },

  selectVertex: (index, mode = 'replace') => {
    set((s) => {
      const selectedVertices = applyListSelection(s.selectedVertices, index, mode);
      if (
        mode === 'remove' &&
        selectedVertices.length === s.selectedVertices.length &&
        !s.selectedVertices.includes(index)
      ) {
        return {};
      }
      const next = {
        ...s,
        selectedVertices,
        selectedEdges: [],
        selectedFaces: [],
      };
      return {
        selectedVertices,
        selectedEdges: [],
        selectedFaces: [],
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  selectEdge: (edgeKey, mode = 'replace') => {
    set((s) => {
      const selectedEdges = applyListSelection(s.selectedEdges, edgeKey, mode);
      if (
        mode === 'remove' &&
        selectedEdges.length === s.selectedEdges.length &&
        !s.selectedEdges.includes(edgeKey)
      ) {
        return {};
      }
      const next = { ...s, selectedEdges, selectedVertices: [], selectedFaces: [] };
      return {
        selectedEdges,
        selectedVertices: [],
        selectedFaces: [],
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  selectFace: (index, mode = 'replace') => {
    set((s) => {
      const selectedFaces = applyListSelection(s.selectedFaces, index, mode);
      if (
        mode === 'remove' &&
        selectedFaces.length === s.selectedFaces.length &&
        !s.selectedFaces.includes(index)
      ) {
        return {};
      }
      const next = { ...s, selectedFaces, selectedVertices: [], selectedEdges: [] };
      const obj = s.objects.find((o) => o.id === s.selectedId);
      const paintFromFace =
        mode === 'replace' &&
        selectedFaces.length === 1 &&
        obj?.mesh?.faceColors?.[selectedFaces[0]];
      return {
        selectedFaces,
        selectedVertices: [],
        selectedEdges: [],
        ...(paintFromFace ? { paintColor: paintFromFace } : {}),
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  clearSubSelection: () =>
    set((s) => ({
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      statusMessage: statusWithSelection({ ...s, selectedVertices: [], selectedEdges: [], selectedFaces: [] }, 'Sub-selection cleared'),
    })),

  setMarqueeActive: (marqueeActive) => set({ marqueeActive }),

  /** @param {string} slotId @param {{ camera: import('three').Camera, width: number, height: number, canvas: HTMLCanvasElement }} handle */
  registerViewportHandle: (slotId, handle) =>
    set((s) => ({
      viewportHandles: { ...s.viewportHandles, [slotId]: handle },
    })),

  unregisterViewportHandle: (slotId) =>
    set((s) => {
      const next = { ...s.viewportHandles };
      delete next[slotId];
      return { viewportHandles: next };
    }),

  /** @param {number[]} indices @param {import('./selection.js').SelectMode} [mode] */
  selectVerticesBatch: (indices, mode = 'replace') => {
    const unique = [...new Set(indices)];
    set((s) => {
      let selectedVertices;
      if (mode === 'replace') {
        selectedVertices = unique;
      } else if (mode === 'add') {
        selectedVertices = [...s.selectedVertices];
        for (const index of unique) {
          selectedVertices = applyListSelection(selectedVertices, index, 'add');
        }
      } else {
        selectedVertices = s.selectedVertices.filter((v) => !unique.includes(v));
      }
      const next = { ...s, selectedVertices, selectedEdges: [], selectedFaces: [] };
      return {
        selectedVertices,
        selectedEdges: [],
        selectedFaces: [],
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  /** @param {string[]} edgeKeys @param {import('./selection.js').SelectMode} [mode] */
  selectEdgesBatch: (edgeKeys, mode = 'replace') => {
    const unique = [...new Set(edgeKeys)];
    set((s) => {
      let selectedEdges;
      if (mode === 'replace') {
        selectedEdges = unique;
      } else if (mode === 'add') {
        selectedEdges = [...s.selectedEdges];
        for (const key of unique) {
          selectedEdges = applyListSelection(selectedEdges, key, 'add');
        }
      } else {
        selectedEdges = s.selectedEdges.filter((k) => !unique.includes(k));
      }
      const next = { ...s, selectedEdges, selectedVertices: [], selectedFaces: [] };
      return {
        selectedEdges,
        selectedVertices: [],
        selectedFaces: [],
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  /** @param {number[]} faceIndices @param {import('./selection.js').SelectMode} [mode] */
  selectFacesBatch: (faceIndices, mode = 'replace') => {
    const unique = [...new Set(faceIndices)];
    set((s) => {
      let selectedFaces;
      if (mode === 'replace') {
        selectedFaces = unique;
      } else if (mode === 'add') {
        selectedFaces = [...s.selectedFaces];
        for (const index of unique) {
          selectedFaces = applyListSelection(selectedFaces, index, 'add');
        }
      } else {
        selectedFaces = s.selectedFaces.filter((f) => !unique.includes(f));
      }
      const next = { ...s, selectedFaces, selectedVertices: [], selectedEdges: [] };
      const obj = s.objects.find((o) => o.id === s.selectedId);
      const paintFromFace =
        mode === 'replace' &&
        selectedFaces.length === 1 &&
        obj?.mesh?.faceColors?.[selectedFaces[0]];
      return {
        selectedFaces,
        selectedVertices: [],
        selectedEdges: [],
        ...(paintFromFace ? { paintColor: paintFromFace } : {}),
        statusMessage: getSelectionSummary(next),
      };
    });
  },

  applyPaintToSelection: () => {
    const { selectedId, objects, selectedFaces, paintColor, editMode } = get();
    if (!selectedId || editMode !== 'face' || selectedFaces.length === 0) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    const mesh = paintFaces(obj.mesh, selectedFaces, paintColor);
    get().replaceMesh(selectedId, mesh);
    set({
      statusMessage:
        selectedFaces.length === 1
          ? `Face painted ${paintColor}`
          : `${selectedFaces.length} faces painted`,
    });
  },

  paintAllFaces: () => {
    const { selectedId, objects, paintColor } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select a mesh object to paint' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh object to paint' });
      return;
    }
    const mesh = paintFaces(
      obj.mesh,
      obj.mesh.faces.map((_, i) => i),
      paintColor,
    );
    get().replaceMesh(selectedId, mesh);
    set({ statusMessage: 'All faces painted' });
  },

  makeFaceFromSelection: () => {
    const { selectedId, objects, selectedVertices, paintColor, editMode, polyDrawActive } = get();
    if (polyDrawActive) {
      get().fillPolyDrawFace();
      return;
    }
    if (editMode !== 'vertex' || !selectedId || selectedVertices.length < 3) {
      set({ statusMessage: 'Select 3 or more vertices to make a face' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh object to make a face' });
      return;
    }
    const mesh = addFace(obj.mesh, selectedVertices, paintColor);
    if (mesh.faceCount === obj.mesh.faceCount) {
      set({ statusMessage: 'Face needs distinct vertices' });
      return;
    }
    get().replaceMesh(selectedId, mesh);
    set({
      editMode: 'face',
      selectedFaces: [mesh.faceCount - 1],
      selectedVertices: [],
      selectedEdges: [],
      statusMessage: 'Face created',
    });
  },

  startExtrudeSession: () => {
    const { selectedId, objects, selectedFaces, extrudeActive, polyDrawActive } = get();
    if (extrudeActive) return;
    if (!selectedId || selectedFaces.length === 0) {
      set({ statusMessage: 'Select one or more faces to extrude' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh object to extrude' });
      return;
    }
    get().pushHistory();
    if (isPolyDrawEngaged(get())) get().finalizePolyDrawSession();
    get().cancelLoopCutSession();
    get().cancelBevelSession();
    get().cancelPrimitiveDraw();
    get().cancelKnifeTool();
    set({
      extrudeActive: true,
      activeTool: 'extrude',
      extrudeBaseMesh: obj.mesh.clone(),
      extrudeFaceIndices: [...selectedFaces],
      extrudeDistance: 0,
      statusMessage:
        'Extrude: drag along normal · scroll nudge · Shift precision · click confirm · Esc cancel',
    });
  },

  updateExtrudeDistance: (distance) => {
    const { extrudeActive, extrudeBaseMesh, extrudeFaceIndices, selectedId, snapGrid, gridSize } =
      get();
    if (!extrudeActive || !extrudeBaseMesh || !selectedId) return;
    let nextDistance = distance;
    if (snapGrid && gridSize > 0) {
      nextDistance = Math.round(distance / gridSize) * gridSize;
    }
    const mesh = extrudeFaces(extrudeBaseMesh, extrudeFaceIndices, nextDistance);
    get().replaceMesh(selectedId, mesh, { skipHistory: true });
    set({
      extrudeDistance: nextDistance,
      statusMessage: `Extrude: ${nextDistance.toFixed(3)} — click confirm · Esc cancel`,
    });
  },

  confirmExtrudeSession: () => {
    const session = get();
    if (!session.extrudeActive) return;
    set({
      ...extrudeSessionEndState(session),
      statusMessage: 'Extrude confirmed',
    });
  },

  cancelExtrudeSession: () => {
    const { extrudeActive, extrudeBaseMesh, selectedId } = get();
    if (!extrudeActive) return;
    if (extrudeBaseMesh && selectedId) get().replaceMesh(selectedId, extrudeBaseMesh, { skipHistory: true });
    set({
      extrudeActive: false,
      activeTool: 'select',
      extrudeBaseMesh: null,
      extrudeFaceIndices: [],
      extrudeDistance: 0,
      statusMessage: 'Extrude cancelled',
    });
  },

  extrudeSelection: () => {
    const { editMode } = get();
    if (editMode === 'edge') get().extrudeSelectedEdges();
    else get().startExtrudeSession();
  },

  extrudeSelectedEdges: () => {
    const { selectedId, objects, selectedEdges, paintColor } = get();
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Select one or more edges to extrude' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge to extrude' });
      return;
    }
    const result = extrudeEdges(obj.mesh, selectedEdges, paintColor);
    if (result.edgeKeys.length === 0) {
      set({ statusMessage: 'No valid edges to extrude' });
      return;
    }
    get().replaceMesh(selectedId, result.mesh);
    set({
      editMode: 'edge',
      transformMode: 'translate',
      selectedEdges: result.edgeKeys,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: 'Edges extruded — move the new edge with the gizmo or mouse drag',
    });
  },

  startKnifeTool: () => {
    const { selectedId, objects } = get();
    const obj = selectedId ? objects.find((o) => o.id === selectedId) : null;
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh object before using Knife' });
      return;
    }
    get().cancelPrimitiveDraw();
    get().cancelPolyDraw();
    get().cancelExtrudeSession();
    get().cancelBevelSession();
    get().cancelLoopCutSession();
    set({
      activeTool: 'knife',
      knifeActive: true,
      knifeStart: null,
      editMode: 'face',
      selectedVertices: [],
      selectedEdges: [],
      statusMessage: 'Knife: click two points across a face (snaps to verts/edges) · Esc cancel',
    });
  },

  cancelKnifeTool: () => {
    if (!get().knifeActive && !get().knifeStart) return;
    set({
      activeTool: 'select',
      knifeActive: false,
      knifeStart: null,
      statusMessage: 'Knife cancelled — vertex/edge/face selection restored',
    });
  },

  applyKnifePoint: (objectId, faceIndex, localPoint, vertexIndex = null, rawLocalPoint = null) => {
    const { knifeActive, knifeStart, objects, selectedId } = get();
    if (!knifeActive || !selectedId || objectId !== selectedId) return;
    const obj = objects.find((o) => o.id === objectId);
    if (!obj?.mesh) return;

    if (!knifeStart) {
      set({
        knifeStart: { objectId, faceIndex, localPoint, vertexIndex, rawLocalPoint: rawLocalPoint ?? localPoint },
        selectedFaces: [faceIndex],
        statusMessage: vertexIndex !== null
          ? 'Knife start set on vertex — pick second point'
          : 'Knife: pick the second point on the same face',
      });
      return;
    }

    const cutFaceIndex = knifeStart.faceIndex;
    const onSameFace =
      faceIndex === cutFaceIndex ||
      localPointOnFace(obj.mesh, cutFaceIndex, localPoint) ||
      localPointOnFace(obj.mesh, cutFaceIndex, rawLocalPoint ?? localPoint);

    if (knifeStart.objectId !== objectId || !onSameFace) {
      set({
        selectedFaces: [cutFaceIndex],
        statusMessage: 'Knife: second point must stay on the same face (Esc to restart)',
      });
      return;
    }

    const startCandidates = [knifeStart.localPoint, knifeStart.rawLocalPoint ?? knifeStart.localPoint];
    const endCandidates = [localPoint, rawLocalPoint ?? localPoint];
    let result = { mesh: obj.mesh, cut: false, faceIndices: [] };
    for (const a of startCandidates) {
      for (const b of endCandidates) {
        const dx = a[0] - b[0];
        const dy = a[1] - b[1];
        const dz = a[2] - b[2];
        if (dx * dx + dy * dy + dz * dz < 1e-8) continue;
        result = knifeCutFace(obj.mesh, cutFaceIndex, a, b);
        if (result.cut) break;
      }
      if (result.cut) break;
    }

    if (!result.cut && startCandidates.length && endCandidates.length) {
      const dx = startCandidates[0][0] - endCandidates[0][0];
      const dy = startCandidates[0][1] - endCandidates[0][1];
      const dz = startCandidates[0][2] - endCandidates[0][2];
      if (dx * dx + dy * dy + dz * dz < 1e-8) {
        set({
          selectedFaces: [cutFaceIndex],
          statusMessage: 'Knife: pick a different second point',
        });
        return;
      }
    }

    if (!result.cut) {
      set({
        knifeStart: { ...knifeStart },
        selectedFaces: [cutFaceIndex],
        statusMessage:
          'Knife cut failed — draw across the face (corner to corner), not along one edge',
      });
      return;
    }
    get().replaceMesh(objectId, result.mesh);
    set({
      ...knifeFinishedState(objectId, result.faceIndices),
      statusMessage: 'Face cut — switch mode or press K to cut again',
    });
  },

  weldSelection: () => {
    const { selectedId, objects, editMode, selectedVertices, selectedEdges, weldThreshold } = get();
    if (!selectedId) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    const verts =
      editMode === 'vertex'
        ? selectedVertices
        : editMode === 'edge'
          ? verticesFromEdgeKeys(selectedEdges)
          : [];
    get().replaceMesh(selectedId, weldSelectedVertices(obj.mesh, verts, weldThreshold));
    set({
      statusMessage: verts.length
        ? `Welded ${verts.length} selected vertex location(s)`
        : `Welded mesh (threshold ${weldThreshold})`,
    });
  },

  setWeldThreshold: (weldThreshold) =>
    set({ weldThreshold: Math.max(0.001, Math.min(1, Number(weldThreshold) || 0.08)) }),

  toggleSnapToMeshFeatures: () =>
    set((s) => ({
      snapToMeshFeatures: !s.snapToMeshFeatures,
      statusMessage: !s.snapToMeshFeatures ? 'Snap to vertices/edges ON' : 'Snap to vertices/edges OFF',
    })),

  insetSelection: () => {
    const { selectedId, objects, editMode, selectedFaces } = get();
    if (!selectedId || editMode !== 'face' || selectedFaces.length === 0) {
      set({ statusMessage: 'Select faces to inset' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    get().replaceMesh(selectedId, insetFaces(obj.mesh, selectedFaces, 0.25));
    set({ statusMessage: `Inset ${selectedFaces.length} face(s)` });
  },

  decimateSelection: () => {
    const { selectedId, objects } = get();
    if (!selectedId) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    get().replaceMesh(selectedId, decimateMesh(obj.mesh, 0.5));
    set({ statusMessage: 'Mesh decimated (~50% detail)' });
  },

  toggleUvSeamOnSelection: () => {
    const { selectedId, objects, editMode, selectedEdges } = get();
    if (!selectedId || editMode !== 'edge' || selectedEdges.length === 0) {
      set({ statusMessage: 'Select edges to mark/clear UV seams' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    const mesh = obj.mesh.clone();
    const seamSet = new Set(mesh.uvSeamEdges);
    for (const key of selectedEdges) {
      if (seamSet.has(key)) seamSet.delete(key);
      else seamSet.add(key);
    }
    mesh.uvSeamEdges = [...seamSet];
    get().replaceMesh(selectedId, mesh);
    set({ statusMessage: 'UV seam edges updated' });
  },

  toggleSharpEdgeOnSelection: () => {
    const { selectedId, objects, editMode, selectedEdges } = get();
    if (!selectedId || editMode !== 'edge' || selectedEdges.length === 0) {
      set({ statusMessage: 'Select edges to mark/clear sharp shading' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    const mesh = obj.mesh.clone();
    const sharpSet = new Set(mesh.sharpEdges);
    for (const key of selectedEdges) {
      if (sharpSet.has(key)) sharpSet.delete(key);
      else sharpSet.add(key);
    }
    mesh.sharpEdges = [...sharpSet];
    get().replaceMesh(selectedId, mesh);
    set({ statusMessage: 'Sharp edge marks updated' });
  },

  openRecentProject: async () => {
    try {
      const recent = await listRecentProjects();
      const entry = recent.find((item) => item.id === 'autosave-current') ?? recent[0];
      if (!entry) {
        set({ statusMessage: 'No recent projects saved yet' });
        return;
      }
      const stored = await loadAutosaveProject(entry.id);
      if (!stored?.project) {
        set({ statusMessage: 'Recent project not found' });
        return;
      }
      get().loadProjectState(normalizeLoadedProject(stored.project));
      if (stored.project.themeId) get().setTheme(stored.project.themeId);
      set({ statusMessage: `Loaded ${entry.label}` });
    } catch (err) {
      set({ statusMessage: `Recent load failed: ${err.message}` });
    }
  },

  persistAutosave: async () => {
    try {
      await saveAutosaveProject('autosave-current', projectSnapshot(get()), 'Autosave');
    } catch {
      /* ignore */
    }
  },

  mergeSelection: () => {
    const { selectedId, objects, editMode, selectedVertices, selectedEdges, selectedFaces } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select vertices or edges to merge' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh to merge' });
      return;
    }

    const vertices =
      editMode === 'vertex'
        ? selectedVertices
        : editMode === 'edge'
          ? verticesFromEdgeKeys(selectedEdges)
          : editMode === 'face'
            ? verticesFromFaceIndices(obj.mesh, selectedFaces)
            : [];
    const unique = [...new Set(vertices)].filter((vi) => vi >= 0 && vi < obj.mesh.vertexCount);
    if (unique.length < 2) {
      set({ statusMessage: 'Select at least two vertices or one edge to merge' });
      return;
    }

    const mesh = mergeVerticesToCenter(obj.mesh, unique);
    get().replaceMesh(selectedId, mesh);
    set({
      editMode: 'vertex',
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      statusMessage: `Merged ${unique.length} vertices`,
    });
  },

  subdivideSelection: () => {
    const { selectedId, objects, editMode, selectedFaces } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select a mesh to subdivide' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh to subdivide' });
      return;
    }
    const faces = editMode === 'face' && selectedFaces.length ? selectedFaces : null;
    get().replaceMesh(selectedId, subdivideFaces(obj.mesh, faces));
    set({ selectedFaces: [], statusMessage: faces ? 'Subdivided selected faces' : 'Subdivided mesh' });
  },

  mirrorSelection: (axis = 'x', options = {}) => {
    const { selectedId, objects, editMode, selectedVertices, selectedEdges, selectedFaces } = get();
    const mode = options.mode ?? 'duplicate';
    if (!selectedId) {
      set({ statusMessage: 'Select a mesh to mirror' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh to mirror' });
      return;
    }

    if (mode === 'flip') {
      const vertices =
        editMode === 'vertex' && selectedVertices.length
          ? selectedVertices
          : editMode === 'edge' && selectedEdges.length
            ? verticesFromEdgeKeys(selectedEdges)
            : editMode === 'face' && selectedFaces.length
              ? verticesFromFaceIndices(obj.mesh, selectedFaces)
              : null;
      get().replaceMesh(selectedId, flipMeshAcrossAxis(obj.mesh, axis, vertices));
      set({ statusMessage: vertices ? `Flipped selection on ${axis.toUpperCase()}` : `Flipped mesh on ${axis.toUpperCase()}` });
      return;
    }

    get().replaceMesh(selectedId, mirrorMesh(obj.mesh, axis));
    set({ statusMessage: `Mirrored geometry on ${axis.toUpperCase()}` });
  },

  mirrorObjectDuplicate: (axis = 'x') => {
    const { selectedId, objects } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select an object to mirror' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj) {
      set({ statusMessage: 'Select an object to mirror' });
      return;
    }
    const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const copy = {
      ...obj,
      id: uid(),
      name: `${obj.name}_mirror_${axis.toUpperCase()}`,
      mesh: obj.mesh ? flipMeshAcrossAxis(obj.mesh, axis, null) : null,
      meshModifiers: obj.meshModifiers ? { ...obj.meshModifiers } : { mirrorEnabled: false, mirrorAxis: 'x', subdivisionLevel: 0 },
      position: obj.position.map((v, i) => (i === axisIdx ? -v : v)),
      locked: false,
    };
    get().pushHistory();
    set((s) => ({
      objects: [...s.objects, copy],
      selectedId: copy.id,
      selectedIds: [copy.id],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      editMode: 'object',
      statusMessage: `Mirrored object on ${axis.toUpperCase()}`,
    }));
  },

  flipNormals: () => {
    const { selectedId, objects, selectedFaces } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select a mesh to flip normals' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh to flip normals' });
      return;
    }
    const faces = selectedFaces.length ? selectedFaces : obj.mesh.faces.map((_, i) => i);
    get().replaceMesh(selectedId, flipFaceNormals(obj.mesh, faces));
    set({ statusMessage: selectedFaces.length ? 'Flipped selected face normals' : 'Flipped all normals' });
  },

  deleteSelectedFaces: () => {
    const { selectedId, objects, selectedFaces } = get();
    if (!selectedId || selectedFaces.length === 0) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    get().replaceMesh(selectedId, removeFaces(obj.mesh, selectedFaces));
    set({ selectedFaces: [], statusMessage: 'Faces deleted' });
  },

  deleteSelectedVertices: () => {
    const { selectedId, objects, selectedVertices } = get();
    if (!selectedId || selectedVertices.length === 0) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    get().replaceMesh(selectedId, removeVertices(obj.mesh, selectedVertices));
    set({ selectedVertices: [], statusMessage: 'Vertices deleted' });
  },

  splitSelectedEdges: () => {
    const { selectedId, objects, selectedEdges } = get();
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Select one or more edges to split' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge to split' });
      return;
    }
    get().replaceMesh(selectedId, splitEdges(obj.mesh, selectedEdges));
    set({ selectedEdges: [], statusMessage: 'Edges split' });
  },

  selectEdgeLoop: () => {
    const { selectedId, objects, selectedEdges } = get();
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Select an edge to select a loop' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge' });
      return;
    }
    const loop = collectEdgeLoop(obj.mesh, selectedEdges[selectedEdges.length - 1]);
    if (loop.length === 0) {
      set({ statusMessage: 'No edge loop found' });
      return;
    }
    set({
      editMode: 'edge',
      selectedEdges: loop,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: `${loop.length} edge${loop.length === 1 ? '' : 's'} in loop`,
    });
  },

  selectEdgeRing: () => {
    const { selectedId, objects, selectedEdges } = get();
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Select an edge to select a ring' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge' });
      return;
    }
    const ring = collectEdgeRing(obj.mesh, selectedEdges[selectedEdges.length - 1]);
    if (ring.length === 0) {
      set({ statusMessage: 'No edge ring found' });
      return;
    }
    set({
      editMode: 'edge',
      selectedEdges: ring,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: `${ring.length} edge${ring.length === 1 ? '' : 's'} in ring`,
    });
  },

  startLoopCutSession: () => {
    const { selectedId, objects, selectedEdges, loopCutActive, polyDrawActive } = get();
    if (loopCutActive) return;
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Edge mode: select an edge, then Loop Cut (L)' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge for Loop Cut' });
      return;
    }
    const ring = collectEdgeRing(obj.mesh, selectedEdges[selectedEdges.length - 1]);
    if (ring.length === 0) {
      set({ statusMessage: 'Loop Cut needs a quad edge ring' });
      return;
    }
    if (isPolyDrawEngaged(get())) get().finalizePolyDrawSession();
    get().cancelExtrudeSession();
    get().cancelBevelSession();
    get().cancelPrimitiveDraw();
    get().cancelKnifeTool();
    get().pushHistory();
    set({
      loopCutActive: true,
      activeTool: 'loopCut',
      loopCutBaseMesh: obj.mesh.clone(),
      loopCutRingKeys: ring,
      loopCutFactor: 0.5,
      loopCutCuts: 1,
      editMode: 'edge',
      selectedEdges: ring,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: 'Loop cut: slide to position · scroll for more cuts · click to confirm',
    });
    get().applyLoopCutPreview();
  },

  applyLoopCutPreview: () => {
    const { loopCutActive, loopCutBaseMesh, loopCutRingKeys, loopCutFactor, loopCutCuts, selectedId } =
      get();
    if (!loopCutActive || !loopCutBaseMesh || !selectedId) return;
    const factors = loopCutFactors(loopCutCuts, loopCutFactor);
    const result = loopCutEdges(loopCutBaseMesh, loopCutRingKeys, factors);
    if (result.cutFaces === 0) {
      set({ statusMessage: 'Loop Cut needs quad topology along the ring' });
      return;
    }
    get().replaceMesh(selectedId, result.mesh, { skipHistory: true });
    set({
      selectedEdges: result.edgeKeys,
      statusMessage:
        loopCutCuts > 1
          ? `Loop cut: ${loopCutCuts} cuts — scroll ± cuts · slide position · click confirm`
          : `Loop cut: ${(loopCutFactor * 100).toFixed(0)}% — slide · scroll for more cuts · click confirm`,
    });
  },

  updateLoopCutFactor: (factor) => {
    if (!get().loopCutActive) return;
    set({ loopCutFactor: Math.max(0.02, Math.min(0.98, factor)) });
    get().applyLoopCutPreview();
  },

  adjustLoopCutCuts: (delta) => {
    if (!get().loopCutActive) return;
    const next = Math.max(1, Math.min(16, get().loopCutCuts + delta));
    set({ loopCutCuts: next });
    get().applyLoopCutPreview();
  },

  confirmLoopCutSession: () => {
    if (!get().loopCutActive) return;
    const { selectedEdges } = get();
    set({
      loopCutActive: false,
      activeTool: 'select',
      loopCutBaseMesh: null,
      loopCutRingKeys: [],
      loopCutFactor: 0.5,
      loopCutCuts: 1,
      editMode: 'edge',
      selectedEdges,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: 'Loop cut confirmed',
    });
  },

  cancelLoopCutSession: () => {
    const { loopCutActive, loopCutBaseMesh, selectedId } = get();
    if (!loopCutActive) return;
    if (loopCutBaseMesh && selectedId) {
      get().replaceMesh(selectedId, loopCutBaseMesh, { skipHistory: true });
    }
    set({
      loopCutActive: false,
      activeTool: 'select',
      loopCutBaseMesh: null,
      loopCutRingKeys: [],
      loopCutFactor: 0.5,
      loopCutCuts: 1,
      statusMessage: 'Loop cut cancelled',
    });
  },

  loopCutSelected: () => {
    get().startLoopCutSession();
  },

  startBevelSession: () => {
    const { selectedId, objects, selectedEdges, bevelActive, polyDrawActive } = get();
    if (bevelActive) return;
    if (!selectedId || selectedEdges.length === 0) {
      set({ statusMessage: 'Edge mode: select edges, then Bevel (B or Ctrl+B)' });
      return;
    }
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) {
      set({ statusMessage: 'Select a mesh edge to bevel' });
      return;
    }
    if (isPolyDrawEngaged(get())) get().finalizePolyDrawSession();
    get().cancelExtrudeSession();
    get().cancelLoopCutSession();
    get().cancelPrimitiveDraw();
    get().cancelKnifeTool();
    get().pushHistory();
    const edgeKeys = [...selectedEdges];
    set({
      bevelActive: true,
      activeTool: 'bevel',
      bevelBaseMesh: obj.mesh.clone(),
      bevelEdgeKeys: edgeKeys,
      bevelAmount: 0.15,
      bevelSegments: 1,
      editMode: 'edge',
      selectedEdges: edgeKeys,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: 'Bevel: slide width · scroll segments · click or Enter to confirm',
    });
    get().applyBevelPreview();
  },

  applyBevelPreview: () => {
    const { bevelActive, bevelBaseMesh, bevelEdgeKeys, bevelAmount, bevelSegments, selectedId, paintColor } =
      get();
    if (!bevelActive || !bevelBaseMesh || !selectedId) return;
    const result = bevelEdges(bevelBaseMesh, bevelEdgeKeys, bevelAmount, paintColor, bevelSegments);
    if (result.faceIndices.length === 0) {
      set({ statusMessage: 'No valid edges to bevel on this mesh' });
      return;
    }
    get().replaceMesh(selectedId, result.mesh, { skipHistory: true });
    const pct = (Math.min(0.45, Math.max(0.01, bevelAmount)) * 100).toFixed(0);
    set({
      selectedEdges: result.edgeKeys.length > 0 ? result.edgeKeys : bevelEdgeKeys,
      statusMessage:
        bevelSegments > 1
          ? `Bevel: ${pct}% · ${bevelSegments} segments — scroll ± · slide width · click confirm`
          : `Bevel: ${pct}% — slide width · scroll for segments · click confirm`,
    });
  },

  updateBevelAmount: (amount) => {
    if (!get().bevelActive) return;
    set({ bevelAmount: Math.max(0.01, Math.min(0.45, amount)) });
    get().applyBevelPreview();
  },

  adjustBevelSegments: (delta) => {
    if (!get().bevelActive) return;
    const next = Math.max(1, Math.min(8, get().bevelSegments + delta));
    set({ bevelSegments: next });
    get().applyBevelPreview();
  },

  confirmBevelSession: () => {
    if (!get().bevelActive) return;
    const { selectedEdges } = get();
    set({
      bevelActive: false,
      activeTool: 'select',
      bevelBaseMesh: null,
      bevelEdgeKeys: [],
      bevelAmount: 0.15,
      bevelSegments: 1,
      editMode: 'edge',
      selectedEdges,
      selectedVertices: [],
      selectedFaces: [],
      statusMessage: 'Bevel confirmed',
    });
  },

  cancelBevelSession: () => {
    const { bevelActive, bevelBaseMesh, selectedId } = get();
    if (!bevelActive) return;
    if (bevelBaseMesh && selectedId) {
      get().replaceMesh(selectedId, bevelBaseMesh, { skipHistory: true });
    }
    set({
      bevelActive: false,
      activeTool: 'select',
      bevelBaseMesh: null,
      bevelEdgeKeys: [],
      bevelAmount: 0.15,
      bevelSegments: 1,
      statusMessage: 'Bevel cancelled',
    });
  },

  bevelSelectedEdges: () => {
    get().startBevelSession();
  },

  deleteSelectedEdges: () => {
    const { selectedId, objects, selectedEdges } = get();
    if (!selectedId || selectedEdges.length === 0) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    get().replaceMesh(selectedId, removeFacesWithEdges(obj.mesh, selectedEdges));
    set({ selectedEdges: [], statusMessage: 'Faces on edges removed' });
  },

  deleteSubSelection: () => {
    const { editMode } = get();
    if (editMode === 'vertex') get().deleteSelectedVertices();
    else if (editMode === 'edge') get().deleteSelectedEdges();
    else if (editMode === 'face') get().deleteSelectedFaces();
    else get().removeSelected();
  },

  moveSelectedVertices: (delta, options = {}) => {
    const { selectedId, objects, selectedVertices, snapGrid, gridSize, snapToMeshFeatures } = get();
    const indices = options.vertexIndices ?? selectedVertices;
    if (!selectedId || indices.length === 0) return;
    const obj = objects.find((o) => o.id === selectedId);
    if (!obj?.mesh) return;
    const vertexSnap = vertexSnapParams(snapGrid, gridSize);
    const snapped = snapVertexDelta(delta, vertexSnap.enabled, vertexSnap.grid);
    let mesh = meshTranslateVertices(obj.mesh, indices, snapped);
    if (snapToMeshFeatures && indices.length > 0) {
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(...obj.position),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...obj.rotation)),
        new THREE.Vector3(...obj.scale),
      );
      const vi = indices[0];
      const p = mesh.getPosition(vi);
      const world = localToWorld(p, obj);
      const feature = snapPointToMeshFeatures(world, mesh, matrix);
      if (feature) {
        const local = worldToLocal(feature, obj);
        const adjust = [local[0] - p[0], local[1] - p[1], local[2] - p[2]];
        mesh = meshTranslateVertices(mesh, indices, adjust);
      }
    }
    get().replaceMesh(selectedId, mesh, options);
  },

  snapSelectionToGrid: () => {
    const { selectedId, objects, editMode, selectedVertices, selectedEdges, selectedFaces, gridSize } = get();
    if (!selectedId) {
      set({ statusMessage: 'Select something to snap' });
      return;
    }

    const obj = objects.find((o) => o.id === selectedId);
    const grid = Number.isFinite(gridSize) && gridSize > 0 ? gridSize : 1;
    if (!obj) {
      set({ statusMessage: 'Select something to snap' });
      return;
    }

    if (editMode === 'object') {
      const [x, y, z] = snapVector3Components(obj.position[0], obj.position[1], obj.position[2], grid);
      get().updateObject(selectedId, { position: [x, y, z] });
      set({ statusMessage: `Object snapped to grid ${grid}` });
      return;
    }

    if (!obj.mesh) {
      set({ statusMessage: 'Select mesh vertices, edges, or faces to snap' });
      return;
    }

    const vertexIndices =
      editMode === 'vertex'
        ? selectedVertices
        : editMode === 'edge'
          ? verticesFromEdgeKeys(selectedEdges)
          : editMode === 'face'
            ? verticesFromFaceIndices(obj.mesh, selectedFaces)
            : [];
    const unique = [...new Set(vertexIndices)].filter((vi) => vi >= 0 && vi < obj.mesh.vertexCount);
    if (unique.length === 0) {
      set({ statusMessage: 'Select vertices, edges, or faces to snap' });
      return;
    }

    const mesh = obj.mesh.clone();
    for (const vi of unique) {
      const world = localToWorld(mesh.getPosition(vi), obj);
      const snapped = snapVector3Components(world[0], world[1], world[2], grid);
      const local = worldToLocal(snapped, obj);
      mesh.setPosition(vi, local[0], local[1], local[2]);
    }

    get().replaceMesh(selectedId, mesh);
    set({ statusMessage: `${unique.length === 1 ? '1 vertex' : `${unique.length} vertices`} snapped to grid ${grid}` });
  },

  getSelectionSummary: () => getSelectionSummary(get()),

  getSelectedObject: () => {
    const { objects, selectedId } = get();
    return objects.find((o) => o.id === selectedId) ?? null;
  },

  getStats: () => {
    const { objects } = get();
    let verts = 0;
    let faces = 0;
    for (const o of objects) {
      if (!o.mesh) continue;
      verts += o.mesh.vertexCount;
      faces += o.mesh.faceCount;
    }
    return { objectCount: objects.length, verts, faces };
  },

  reorderObject: (id, direction) => {
    const { objects } = get();
    const idx = objects.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const next = [...objects];
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    get().pushHistory();
    [next[idx], next[swap]] = [next[swap], next[idx]];
    set({ objects: next });
  },
  moveObjectToIndex: (id, toIndex) => {
    const { objects } = get();
    const fromIndex = objects.findIndex((o) => o.id === id);
    if (fromIndex < 0) return;
    const clamped = Math.max(0, Math.min(objects.length - 1, toIndex));
    if (fromIndex === clamped) return;
    const next = [...objects];
    const [item] = next.splice(fromIndex, 1);
    next.splice(clamped, 0, item);
    get().pushHistory();
    set({ objects: next, statusMessage: 'Layer order updated' });
  },
}));
