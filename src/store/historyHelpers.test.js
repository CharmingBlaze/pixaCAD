import { describe, expect, it } from 'vitest';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { restoreObjects, snapshotObjects, captureHistoryState, applyHistorySnapshot } from './historyHelpers.js';

describe('historyHelpers', () => {
  it('restores mesh with aligned face colors', () => {
    const mesh = new EditableMesh({
      name: 'Tri',
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      faces: [[0, 1, 2]],
      faceColors: ['#ff0000'],
    });
    const objects = [
      {
        id: 'a',
        name: 'Tri',
        parentId: null,
        isGroup: false,
        mesh,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureDataUrl: null,
        visible: true,
        locked: false,
      },
    ];
    const snap = snapshotObjects(objects);
    const restored = restoreObjects(snap);
    expect(restored[0].mesh?.faceCount).toBe(1);
    expect(restored[0].mesh?.faceColors[0]).toBe('#ff0000');
  });

  it('drops invalid parent references', () => {
    const restored = restoreObjects([
      {
        id: 'child',
        name: 'Child',
        parentId: 'missing',
        isGroup: false,
        mesh: null,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureDataUrl: null,
        visible: true,
        locked: false,
      },
    ]);
    expect(restored[0].parentId).toBeNull();
  });

  it('captures and restores reference images', () => {
    const state = {
      objects: [],
      referenceImagesByView: {
        front: [{ id: 'r1', name: 'Ref', dataUrl: 'data:', x: 1, y: 2, width: 10, height: 10, rotation: 0, opacity: 1, locked: false }],
      },
      selectedId: null,
      selectedIds: [],
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
    };
    const snap = captureHistoryState(state);
    const applied = applyHistorySnapshot(snap);
    expect(applied.referenceImagesByView.front[0].x).toBe(1);
    expect(applied.referenceImagesByView.front).not.toBe(state.referenceImagesByView.front);
  });
});
