const MAX_STEPS = 64;

/**
 * @typedef {Object} HistorySnapshot
 * @property {import('../../store/editorStore.js').SceneObjectSnapshot[]} objects
 * @property {Record<string, import('../../store/historyHelpers.js').ReferenceImageSnapshot[]>} [referenceImagesByView]
 * @property {string | null} selectedId
 * @property {string[]} selectedIds
 * @property {number[]} selectedVertices
 * @property {string[]} selectedEdges
 * @property {number[]} selectedFaces
 */

/**
 * @param {HistorySnapshot} a
 * @param {HistorySnapshot} b
 */
function snapshotsEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * @param {HistorySnapshot} snapshot
 * @returns {HistorySnapshot}
 */
function cloneSnapshot(snapshot) {
  return {
    objects: snapshot.objects.map((o) => ({
      ...o,
      mesh: o.mesh
        ? {
            name: o.mesh.name,
            positions: [...o.mesh.positions],
            faces: o.mesh.faces.map((f) => [...f]),
            faceColors: [...o.mesh.faceColors],
            faceUVs: o.mesh.faceUVs?.map((uvs) => uvs.map((uv) => [uv[0], uv[1]])) ?? [],
          }
        : null,
      position: [...o.position],
      rotation: [...o.rotation],
      scale: [...o.scale],
      textureDataUrl: o.textureDataUrl ?? null,
      textureLayers: o.textureLayers?.map((layer) => ({ ...layer })) ?? [],
      visible: o.visible,
      locked: !!o.locked,
      isGroup: !!o.isGroup,
      parentId: o.parentId ?? null,
    })),
    referenceImagesByView: Object.fromEntries(
      Object.entries(snapshot.referenceImagesByView ?? {}).map(([viewId, images]) => [
        viewId,
        (images ?? []).map((img) => ({ ...img })),
      ]),
    ),
    selectedId: snapshot.selectedId,
    selectedIds: [...(snapshot.selectedIds ?? (snapshot.selectedId ? [snapshot.selectedId] : []))],
    selectedVertices: [...snapshot.selectedVertices],
    selectedEdges: [...snapshot.selectedEdges],
    selectedFaces: [...snapshot.selectedFaces],
  };
}

export function createUndoStack() {
  /** @type {HistorySnapshot[]} */
  const past = [];
  /** @type {HistorySnapshot[]} */
  const future = [];

  return {
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,

    /** @param {HistorySnapshot} snapshot */
    push(snapshot) {
      const cloned = cloneSnapshot(snapshot);
      const last = past[past.length - 1];
      if (last && snapshotsEqual(last, cloned)) return;
      past.push(cloned);
      if (past.length > MAX_STEPS) past.shift();
      future.length = 0;
    },

    /** @returns {HistorySnapshot | null} */
    undo(current) {
      if (past.length === 0) return null;
      future.push(cloneSnapshot(current));
      return past.pop() ?? null;
    },

    /** @returns {HistorySnapshot | null} */
    redo(current) {
      if (future.length === 0) return null;
      past.push(cloneSnapshot(current));
      return future.pop() ?? null;
    },

    clear() {
      past.length = 0;
      future.length = 0;
    },
  };
}
