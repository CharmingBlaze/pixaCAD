import { DEFAULT_PAINT_COLOR } from '../lib/defaultColors.js';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';

/**
 * @typedef {Object} ReferenceImageSnapshot
 * @property {string} id
 * @property {string} name
 * @property {string} dataUrl
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {number} opacity
 * @property {boolean} locked
 */

/**
 * @param {Record<string, ReferenceImageSnapshot[]> | undefined} refByView
 */
export function cloneReferenceImagesByView(refByView) {
  if (!refByView || typeof refByView !== 'object') return {};
  return Object.fromEntries(
    Object.entries(refByView).map(([viewId, images]) => [
      viewId,
      (images ?? []).map((img) => ({ ...img })),
    ]),
  );
}

/**
 * @typedef {Object} SceneObjectSnapshot
 * @property {string} id
 * @property {string} name
 * @property {string | null} parentId
 * @property {boolean} isGroup
 * @property {{ name: string, positions: number[], faces: number[][], faceColors: string[], faceUVs?: [number, number][][] } | null} mesh
 * @property {[number, number, number]} position
 * @property {[number, number, number]} rotation
 * @property {[number, number, number]} scale
 * @property {string | null} textureDataUrl
 * @property {{ id: string, name: string, visible: boolean, opacity: number, kind?: string, dataUrl: string | null }[]} textureLayers
 * @property {boolean} visible
 * @property {boolean} locked
 */

/**
 * @param {SceneObjectSnapshot['mesh']} mesh
 * @returns {SceneObjectSnapshot['mesh']}
 */
function normalizeMeshSnapshot(mesh) {
  if (!mesh || !Array.isArray(mesh.positions) || !Array.isArray(mesh.faces)) return null;

  const positions = mesh.positions.map(Number).filter((n) => Number.isFinite(n));
  if (positions.length < 9 || positions.length % 3 !== 0) return null;

  const faces = mesh.faces
    .filter((face) => Array.isArray(face) && face.length >= 3)
    .map((face) => {
      const indices = face.map((vi) => Number(vi)).filter((vi) => Number.isInteger(vi) && vi >= 0);
      return [...new Set(indices)];
    })
    .filter((face) => face.length >= 3);

  if (faces.length === 0) return null;

  const maxIndex = positions.length / 3 - 1;
  const validFaces = faces
    .map((face) => face.filter((vi) => vi <= maxIndex))
    .filter((face) => face.length >= 3);

  if (validFaces.length === 0) return null;

  const faceCount = validFaces.length;
  let faceColors = Array.isArray(mesh.faceColors) ? mesh.faceColors.map(String) : [];
  while (faceColors.length < faceCount) faceColors.push(DEFAULT_PAINT_COLOR);
  faceColors = faceColors.slice(0, faceCount);

  let faceUVs = Array.isArray(mesh.faceUVs) ? mesh.faceUVs : [];
  faceUVs = validFaces.map((face, fi) => {
    const uvs = faceUVs[fi];
    if (!Array.isArray(uvs) || uvs.length !== face.length) return null;
    return uvs.map((uv) => {
      const u = Number(uv?.[0]);
      const v = Number(uv?.[1]);
      return [Number.isFinite(u) ? u : 0, Number.isFinite(v) ? v : 0];
    });
  });

  const hasAllUvs = faceUVs.every((uvs) => uvs !== null);

  return {
    name: String(mesh.name || 'Mesh'),
    positions,
    faces: validFaces,
    faceColors,
    ...(hasAllUvs ? { faceUVs } : {}),
    uvSeamEdges: Array.isArray(mesh.uvSeamEdges) ? mesh.uvSeamEdges.map(String) : [],
    sharpEdges: Array.isArray(mesh.sharpEdges) ? mesh.sharpEdges.map(String) : [],
  };
}

/**
 * @param {import('./editorStore.js').SceneObject[]} objects
 * @returns {SceneObjectSnapshot[]}
 */
export function snapshotObjects(objects) {
  return objects.map((o) => ({
    id: o.id,
    name: o.name,
    parentId: o.parentId ?? null,
    isGroup: !!o.isGroup,
    mesh: o.isGroup || !o.mesh
      ? null
      : {
          name: o.mesh.name,
          positions: [...o.mesh.positions],
          faces: o.mesh.faces.map((f) => [...f]),
          faceColors: [...o.mesh.faceColors],
          faceUVs: o.mesh.faceUVs.map((uvs) => uvs.map((uv) => [uv[0], uv[1]])),
          uvSeamEdges: [...(o.mesh.uvSeamEdges ?? [])],
          sharpEdges: [...(o.mesh.sharpEdges ?? [])],
        },
    position: [...o.position],
    rotation: [...o.rotation],
    scale: [...o.scale],
    textureDataUrl: o.textureDataUrl ?? null,
    textureLayers: Array.isArray(o.textureLayers)
      ? o.textureLayers.map((layer) => ({
          id: String(layer.id || ''),
          name: String(layer.name || 'Layer'),
          visible: layer.visible !== false,
          opacity: Number.isFinite(Number(layer.opacity)) ? Math.max(0, Math.min(1, Number(layer.opacity))) : 1,
          kind: typeof layer.kind === 'string' ? layer.kind : 'paint',
          dataUrl: typeof layer.dataUrl === 'string' ? layer.dataUrl : null,
        }))
      : [],
    visible: o.visible !== false,
    locked: !!o.locked,
  }));
}

/**
 * @param {SceneObjectSnapshot[]} snapshots
 * @returns {import('./editorStore.js').SceneObject[]}
 */
export function restoreObjects(snapshots) {
  if (!Array.isArray(snapshots)) return [];

  const objects = snapshots.map((o) => {
    const isGroup = !!o.isGroup;
    const meshData = isGroup ? null : normalizeMeshSnapshot(o.mesh);
    return {
      id: String(o.id || ''),
      name: String(o.name || 'Object'),
      parentId: o.parentId ?? null,
      isGroup,
      mesh: meshData ? new EditableMesh(meshData) : null,
      position: Array.isArray(o.position) && o.position.length === 3
        ? o.position.map(Number)
        : [0, 0, 0],
      rotation: Array.isArray(o.rotation) && o.rotation.length === 3
        ? o.rotation.map(Number)
        : [0, 0, 0],
      scale: Array.isArray(o.scale) && o.scale.length === 3 ? o.scale.map(Number) : [1, 1, 1],
      textureDataUrl: typeof o.textureDataUrl === 'string' ? o.textureDataUrl : null,
      textureLayers: Array.isArray(o.textureLayers)
        ? o.textureLayers
            .filter((layer) => layer && typeof layer === 'object')
            .map((layer, index) => ({
              id: String(layer.id || `texture_layer_${index}`),
              name: String(layer.name || 'Layer'),
              visible: layer.visible !== false,
              opacity: Number.isFinite(Number(layer.opacity)) ? Math.max(0, Math.min(1, Number(layer.opacity))) : 1,
              kind: typeof layer.kind === 'string' ? layer.kind : 'paint',
              dataUrl: typeof layer.dataUrl === 'string' ? layer.dataUrl : null,
            }))
        : [],
      visible: o.visible !== false,
      locked: !!o.locked,
    };
  });

  const ids = new Set(objects.map((o) => o.id).filter(Boolean));
  for (const obj of objects) {
    if (!obj.id) continue;
    if (obj.parentId && !ids.has(obj.parentId)) obj.parentId = null;
    if (obj.isGroup && obj.mesh) {
      obj.mesh = null;
    }
    if (!obj.isGroup && !obj.mesh) {
      obj.isGroup = true;
    }
  }

  return objects.filter((o) => o.id);
}

/**
 * @param {import('./editorStore.js').EditorState} state
 */
export function captureHistoryState(state) {
  const selectedIds =
    Array.isArray(state.selectedIds) && state.selectedIds.length > 0
      ? [...state.selectedIds]
      : state.selectedId
        ? [state.selectedId]
        : [];
  return {
    objects: snapshotObjects(state.objects),
    referenceImagesByView: cloneReferenceImagesByView(state.referenceImagesByView),
    selectedId: state.selectedId,
    selectedIds,
    selectedVertices: [...state.selectedVertices],
    selectedEdges: [...state.selectedEdges],
    selectedFaces: [...state.selectedFaces],
  };
}

/**
 * Restore editor scene + selection from a history snapshot.
 * @param {ReturnType<typeof captureHistoryState>} snap
 */
export function applyHistorySnapshot(snap) {
  return {
    objects: restoreObjects(snap.objects).map((o) => ({
      ...o,
      textureRevision: (o.textureRevision ?? 0) + 1,
    })),
    referenceImagesByView: cloneReferenceImagesByView(snap.referenceImagesByView),
    selectedId: snap.selectedId,
    selectedIds: snap.selectedIds ?? (snap.selectedId ? [snap.selectedId] : []),
    selectedVertices: [...snap.selectedVertices],
    selectedEdges: [...snap.selectedEdges],
    selectedFaces: [...snap.selectedFaces],
  };
}
