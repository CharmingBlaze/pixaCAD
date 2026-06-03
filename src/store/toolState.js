import { DEFAULT_HEIGHT } from '../lib/draw/cadDraw.js';

/** @typedef {'select' | 'extrude' | 'polyDraw' | 'primitiveDraw' | 'knife' | 'loopCut' | 'bevel'} ActiveTool */

/**
 * True while poly draw is on or leftover session flags would block normal editing.
 * @param {import('./editorStore.js').EditorState} state
 */
export function isPolyDrawEngaged(state) {
  return !!(
    state.polyDrawActive ||
    state.polyDrawTargetId ||
    state.activeTool === 'polyDraw'
  );
}

/**
 * Return to object mode when sub-object editing has no valid target (e.g. after Esc/undo).
 * @param {import('./editorStore.js').EditorState} state
 */
export function normalizeStrandedEditMode(state) {
  if (state.editMode === 'object' || isPolyDrawEngaged(state)) return {};

  const selected = state.selectedId
    ? state.objects?.find((o) => o.id === state.selectedId)
    : null;
  if (selected?.mesh && !selected.isGroup) return {};

  return {
    editMode: 'object',
    transformMode: 'translate',
    gizmoAxisLock: null,
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: [],
    hoveredFace: null,
    hoveredVertex: null,
    hoveredEdge: null,
  };
}

/**
 * Clears in-progress tool sessions (draw, extrude, knife, vertex drag).
 * Does not clear scene objects or selection.
 */
export function inactiveToolState() {
  return {
    activeTool: /** @type {ActiveTool} */ ('select'),
    pendingPrimitive: null,
    drawPhase: 'idle',
    drawStart: null,
    drawCorner2: null,
    drawHeight: DEFAULT_HEIGHT,
    drawViewId: null,
    drawRevision: 0,
    polyDrawActive: false,
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
    marqueeActive: false,
    vertexManipActive: false,
    vertexManipSession: null,
    interactiveTransformActive: false,
    interactiveTransformMode: null,
    objectInteractiveSession: null,
    interactiveMeshTick: 0,
    gizmoInteracting: false,
  };
}

/**
 * State after poly draw completes — normal object editing, mesh kept selected.
 * @param {string} objectId
 */
export function polyDrawFinishedState(objectId) {
  return {
    ...inactiveToolState(),
    editMode: 'object',
    transformMode: 'translate',
    gizmoAxisLock: null,
    selectedId: objectId,
    selectedIds: [objectId],
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: [],
    hoveredFace: null,
    hoveredVertex: null,
    hoveredEdge: null,
  };
}

/** @param {string} objectId @param {string} statusMessage */
export function polyDrawFinishedPatch(objectId, statusMessage) {
  return { ...polyDrawFinishedState(objectId), statusMessage };
}

/**
 * End poly draw and return to normal object editing (keeps mesh work when faces were added).
 * @param {import('./editorStore.js').SceneObject[]} objects
 * @param {import('./editorStore.js').EditorState} session
 */
export function polyDrawSessionEndState(objects, session) {
  const { polyDrawTargetId, polyDrawBaseMesh, polyDrawCreatedObject, polyDrawRevertOnCancel, meshRevision } =
    session;

  if (!polyDrawTargetId) {
    return {
      ...inactiveToolState(),
      editMode: 'object',
      transformMode: 'translate',
      gizmoAxisLock: null,
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      hoveredFace: null,
      hoveredVertex: null,
      hoveredEdge: null,
      statusMessage: 'Poly draw off',
    };
  }

  const target = objects.find((o) => o.id === polyDrawTargetId);
  const removeEmptyCreatedObject =
    polyDrawCreatedObject && target?.mesh && target.mesh.faceCount === 0;

  const baseFaceCount = polyDrawBaseMesh?.faceCount ?? 0;
  const currentFaceCount = target?.mesh?.faceCount ?? 0;
  const addedFaces = currentFaceCount > baseFaceCount;
  const revertMesh =
    !!polyDrawRevertOnCancel &&
    !!polyDrawBaseMesh &&
    !!target &&
    !addedFaces &&
    currentFaceCount <= baseFaceCount;

  let nextObjects = objects;
  if (removeEmptyCreatedObject) {
    nextObjects = objects.filter((o) => o.id !== polyDrawTargetId);
  } else if (revertMesh) {
    nextObjects = objects.map((o) =>
      o.id === polyDrawTargetId ? { ...o, mesh: polyDrawBaseMesh } : o,
    );
  }

  const selectedId = removeEmptyCreatedObject
    ? null
    : (target?.id ?? session.selectedId ?? null);
  const nextMeshRevision = revertMesh ? meshRevision + 1 : meshRevision;

  if (removeEmptyCreatedObject || !selectedId || !target?.mesh || target.mesh.faceCount === 0) {
    return {
      ...inactiveToolState(),
      objects: nextObjects,
      meshRevision: nextMeshRevision,
      selectedId,
      selectedIds: selectedId ? [selectedId] : [],
      editMode: 'object',
      statusMessage: removeEmptyCreatedObject ? 'Poly draw cancelled' : 'Poly draw off',
    };
  }

  return {
    ...polyDrawFinishedState(selectedId),
    objects: nextObjects,
    meshRevision: nextMeshRevision,
    statusMessage: 'Poly draw off — object ready to move',
  };
}

/**
 * After a face is committed while poly draw stays active.
 * @param {string} objectId
 * @param {string} statusMessage
 */
export function polyDrawContinuedPatch(objectId, statusMessage) {
  return {
    activeTool: /** @type {ActiveTool} */ ('polyDraw'),
    polyDrawActive: true,
    polyDrawTargetId: objectId,
    polyDrawVerts: [],
    polyDrawAnchor: null,
    polyDrawCreatedObject: false,
    editMode: 'vertex',
    selectedId: objectId,
    selectedIds: [objectId],
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: [],
    hoveredFace: null,
    hoveredVertex: null,
    hoveredEdge: null,
    statusMessage,
  };
}

/**
 * State after extrude confirms — stay in the current edit mode.
 * @param {import('./editorStore.js').EditorState} session
 */
export function extrudeSessionEndState(session) {
  const { selectedId, editMode, extrudeFaceIndices } = session;
  return {
    extrudeActive: false,
    activeTool: /** @type {ActiveTool} */ ('select'),
    extrudeBaseMesh: null,
    extrudeFaceIndices: [],
    extrudeDistance: 0,
    editMode,
    selectedId,
    selectedIds: selectedId ? [selectedId] : [],
    selectedVertices: [],
    selectedEdges: [],
    selectedFaces: editMode === 'face' ? [...extrudeFaceIndices] : [],
    hoveredFace: null,
    hoveredVertex: null,
    hoveredEdge: null,
  };
}

/**
 * State after knife cut commits — stay in face mode, knife off.
 * @param {string} objectId
 * @param {number[]} faceIndices
 */
export function knifeFinishedState(objectId, faceIndices) {
  return {
    knifeStart: null,
    knifeActive: false,
    activeTool: 'select',
    editMode: 'face',
    selectedId: objectId,
    selectedIds: [objectId],
    selectedFaces: faceIndices,
    selectedVertices: [],
    selectedEdges: [],
    hoveredFace: null,
    hoveredVertex: null,
    hoveredEdge: null,
  };
}
