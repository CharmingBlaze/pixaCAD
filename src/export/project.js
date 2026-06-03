import { DEFAULT_PAINT_COLOR } from '../lib/defaultColors.js';
import { APP_ID, BRAND_NAME, isValidProjectApp, PROJECT_FILE_NAME } from '../lib/brand.js';
import { restoreObjects, snapshotObjects } from '../store/historyHelpers.js';
import { readFileText, saveTextNative, openTextNative } from './fileSave.js';

const PROJECT_VERSION = 2;

/**
 * @param {import('../store/editorStore.js').EditorState} state
 */
export function projectSnapshot(state) {
  return {
    app: APP_ID,
    version: PROJECT_VERSION,
    savedAt: new Date().toISOString(),
    objects: snapshotObjects(state.objects),
    selectedId: state.selectedId,
    selectedIds:
      Array.isArray(state.selectedIds) && state.selectedIds.length > 0
        ? [...state.selectedIds]
        : state.selectedId
          ? [state.selectedId]
          : [],
    editMode: state.editMode,
    transformMode: state.transformMode,
    selectedVertices: [...state.selectedVertices],
    selectedEdges: [...state.selectedEdges],
    selectedFaces: [...state.selectedFaces],
    paintColor: state.paintColor,
    renderMode: state.renderMode,
    viewportLayoutMode: state.viewportLayoutMode,
    referenceImagesByView: state.referenceImagesByView ?? {},
    snapGrid: state.snapGrid,
    gridSize: state.gridSize,
    showWireframe: state.showWireframe,
    showXRay: state.showXRay,
    showGrid: state.showGrid,
    themeId: state.themeId,
    weldThreshold: state.weldThreshold,
    snapToMeshFeatures: state.snapToMeshFeatures,
    activeViewport: state.activeViewport,
    gizmoAxisLock: state.gizmoAxisLock,
  };
}

/**
 * @param {unknown} raw
 * @returns {import('../store/editorStore.js').SceneObject[]}
 */
function parseObjects(raw) {
  if (!Array.isArray(raw)) return [];
  return restoreObjects(raw);
}

/**
 * @param {import('../store/editorStore.js').SceneObject[]} objects
 * @param {string | null} selectedId
 */
function resolveSelectedId(objects, selectedId) {
  const ids = new Set(objects.map((o) => o.id));
  if (selectedId && ids.has(selectedId)) return selectedId;
  return objects[0]?.id ?? null;
}

/** @param {import('../lib/mesh/EditableMesh.js').EditableMesh | null} mesh */
function sanitizeSubSelection(mesh, vertices, edges, faces) {
  if (!mesh) {
    return { selectedVertices: [], selectedEdges: [], selectedFaces: [] };
  }
  const edgeKeySet = new Set(mesh.getEdges().map(([a, b]) => (a < b ? `${a}_${b}` : `${b}_${a}`)));
  return {
    selectedVertices: vertices.filter((vi) => vi >= 0 && vi < mesh.vertexCount),
    selectedEdges: edges.filter((key) => edgeKeySet.has(key)),
    selectedFaces: faces.filter((fi) => fi >= 0 && fi < mesh.faceCount),
  };
}

/**
 * @param {ReturnType<typeof projectSnapshot>} project
 */
export function normalizeLoadedProject(project) {
  const objects = parseObjects(project.objects);
  const selectedId = resolveSelectedId(objects, project.selectedId ?? null);
  const rawSelectedIds = Array.isArray(project.selectedIds) ? project.selectedIds : [];
  const idSet = new Set(objects.map((o) => o.id));
  const selectedIds = rawSelectedIds.filter((id) => idSet.has(id));
  const resolvedSelectedIds =
    selectedIds.length > 0 ? selectedIds : selectedId ? [selectedId] : [];
  const selected = objects.find((o) => o.id === (resolvedSelectedIds[0] ?? selectedId));
  const sub = sanitizeSubSelection(
    selected?.mesh ?? null,
    Array.isArray(project.selectedVertices) ? project.selectedVertices : [],
    Array.isArray(project.selectedEdges) ? project.selectedEdges : [],
    Array.isArray(project.selectedFaces) ? project.selectedFaces : [],
  );

  const editModes = new Set(['object', 'vertex', 'edge', 'face']);
  const transformModes = new Set(['translate', 'rotate', 'scale']);
  const renderModes = new Set(['solid', 'textured', 'wireframe', 'outline']);
  const layoutModes = new Set(['quad', 'single', 'splitVertical', 'splitHorizontal']);
  const viewports = new Set(['perspective', 'front', 'top', 'right']);

  return {
    objects,
    selectedId: resolvedSelectedIds[resolvedSelectedIds.length - 1] ?? selectedId,
    selectedIds: resolvedSelectedIds,
    editMode: editModes.has(project.editMode) ? project.editMode : 'object',
    transformMode: transformModes.has(project.transformMode) ? project.transformMode : 'translate',
    selectedVertices: sub.selectedVertices,
    selectedEdges: sub.selectedEdges,
    selectedFaces: sub.selectedFaces,
    paintColor: typeof project.paintColor === 'string' ? project.paintColor : DEFAULT_PAINT_COLOR,
    renderMode: renderModes.has(project.renderMode) ? project.renderMode : 'textured',
    viewportLayoutMode: layoutModes.has(project.viewportLayoutMode)
      ? project.viewportLayoutMode
      : 'quad',
    referenceImagesByView:
      project.referenceImagesByView && typeof project.referenceImagesByView === 'object'
        ? project.referenceImagesByView
        : {},
    snapGrid: !!project.snapGrid,
    gridSize: Number.isFinite(project.gridSize) && project.gridSize > 0 ? project.gridSize : 1,
    showWireframe: !!project.showWireframe,
    showXRay: !!project.showXRay,
    showGrid: project.showGrid !== false,
    themeId: typeof project.themeId === 'string' ? project.themeId : undefined,
    weldThreshold:
      Number.isFinite(project.weldThreshold) && project.weldThreshold > 0 ? project.weldThreshold : undefined,
    snapToMeshFeatures: project.snapToMeshFeatures !== undefined ? !!project.snapToMeshFeatures : undefined,
    activeViewport: viewports.has(project.activeViewport) ? project.activeViewport : 'perspective',
    gizmoAxisLock:
      project.gizmoAxisLock === 'X' || project.gizmoAxisLock === 'Y' || project.gizmoAxisLock === 'Z'
        ? project.gizmoAxisLock
        : null,
  };
}

export async function saveProject(state) {
  let text;
  try {
    text = JSON.stringify(projectSnapshot(state), null, 2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      message.includes('circular') || message.includes('too large')
        ? 'Project is too large to save (try fewer or smaller textures)'
        : `Could not serialize project: ${message}`,
    );
  }
  await saveTextNative(text, PROJECT_FILE_NAME, `${BRAND_NAME} project`);
}

/** @param {string} text */
export function parseProjectText(text) {
  let project;
  try {
    project = JSON.parse(text);
  } catch {
    throw new Error('Project file is not valid JSON');
  }
  if (!project || typeof project !== 'object') {
    throw new Error('Project file is empty or invalid');
  }
  if (!isValidProjectApp(project.app)) {
    throw new Error(`This is not a ${BRAND_NAME} project file`);
  }
  if (!Array.isArray(project.objects)) {
    throw new Error('Project file is missing scene objects');
  }
  const version = Number(project.version) || 1;
  if (version > PROJECT_VERSION) {
    throw new Error(`Project version ${version} is newer than this app supports`);
  }
  return normalizeLoadedProject(project);
}

/** Load a project via the native open dialog (desktop only). */
export async function loadProjectFromDesktop() {
  const text = await openTextNative(`Open ${BRAND_NAME} project`);
  if (!text) return null;
  return parseProjectText(text);
}

export async function loadProjectFile(file) {
  if (!file) throw new Error('No project file selected');
  const text = await readFileText(file);
  return parseProjectText(text);
}
