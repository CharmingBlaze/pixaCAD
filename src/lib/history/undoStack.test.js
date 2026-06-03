import { describe, expect, it } from 'vitest';
import { createUndoStack } from './undoStack.js';

const baseSnap = {
  objects: [],
  referenceImagesByView: {},
  selectedId: null,
  selectedIds: [],
  selectedVertices: [],
  selectedEdges: [],
  selectedFaces: [],
};

describe('createUndoStack', () => {
  it('skips duplicate consecutive snapshots', () => {
    const stack = createUndoStack();
    stack.push(baseSnap);
    stack.push({ ...baseSnap });
    expect(stack.canUndo()).toBe(true);
    const current = { ...baseSnap, selectedId: 'live', selectedIds: ['live'] };
    const restored = stack.undo(current);
    expect(restored).toEqual(baseSnap);
    expect(stack.canUndo()).toBe(false);
  });

  it('stores up to 64 steps', () => {
    const stack = createUndoStack();
    for (let i = 0; i < 70; i++) {
      stack.push({
        ...baseSnap,
        selectedId: `step-${i}`,
        selectedIds: [`step-${i}`],
      });
    }
    let count = 0;
    let current = { ...baseSnap, selectedId: 'step-69', selectedIds: ['step-69'] };
    while (stack.canUndo()) {
      const snap = stack.undo(current);
      if (!snap) break;
      current = snap;
      count += 1;
    }
    expect(count).toBe(64);
    expect(current.selectedId).toBe('step-6');
  });

  it('redo restores undone state', () => {
    const stack = createUndoStack();
    stack.push(baseSnap);
    const a = { ...baseSnap, selectedId: 'a', selectedIds: ['a'] };
    stack.undo(a);
    expect(stack.canRedo()).toBe(true);
    const redone = stack.redo(baseSnap);
    expect(redone?.selectedId).toBe('a');
  });
});
