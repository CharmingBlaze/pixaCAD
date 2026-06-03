import { describe, expect, it } from 'vitest';
import { duplicateSubtrees, pasteObjectSnapshots, snapshotSelectedSubtree } from './sceneClipboard.js';

const objects = [
  { id: 'g1', name: 'Group', parentId: null, isGroup: true, mesh: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false },
  { id: 'c1', name: 'Child', parentId: 'g1', isGroup: true, mesh: null, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], visible: true, locked: false },
];

describe('sceneClipboard', () => {
  it('deep-duplicates group children', () => {
    const copies = duplicateSubtrees(objects, ['g1']);
    expect(copies.length).toBe(2);
    const group = copies.find((o) => o.name === 'Group_copy');
    const child = copies.find((o) => o.name === 'Child_copy');
    expect(group?.parentId).toBeNull();
    expect(child?.parentId).toBe(group?.id);
  });

  it('pastes snapshots with remapped ids', () => {
    const snapshots = snapshotSelectedSubtree(objects, ['g1']);
    const pasted = pasteObjectSnapshots(snapshots);
    expect(pasted.length).toBe(2);
    expect(new Set(pasted.map((o) => o.id)).size).toBe(2);
  });
});
