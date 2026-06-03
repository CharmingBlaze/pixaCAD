import { describe, expect, it } from 'vitest';
import {
  coalesceSelectedIds,
  filterOutAncestorSelections,
  isObjectSelected,
  nextObjectSelection,
  nextObjectSelectionBatch,
  selectedObjectCount,
} from './objectSelection.js';

describe('objectSelection', () => {
  it('coalesceSelectedIds prefers selectedIds array', () => {
    expect(coalesceSelectedIds({ selectedId: 'a', selectedIds: ['b', 'c'] })).toEqual(['b', 'c']);
    expect(coalesceSelectedIds({ selectedId: 'a', selectedIds: [] })).toEqual(['a']);
  });

  it('shift-style toggle adds and removes ids', () => {
    expect(nextObjectSelection('b', { additive: true }, ['a']).selectedIds).toEqual(['a', 'b']);
    expect(nextObjectSelection('a', { additive: true }, ['a', 'b']).selectedIds).toEqual(['b']);
  });

  it('filterOutAncestorSelections drops parent when child also selected', () => {
    const objects = [
      { id: 'g', parentId: null, isGroup: true },
      { id: 'c', parentId: 'g', isGroup: false },
    ];
    expect(filterOutAncestorSelections(objects, ['g', 'c'])).toEqual(['c']);
  });

  it('isObjectSelected reads store fields without allocating', () => {
    const state = { selectedId: 'a', selectedIds: ['a', 'b'], objects: [] };
    expect(isObjectSelected(state, 'b')).toBe(true);
    expect(isObjectSelected(state, 'c')).toBe(false);
    expect(selectedObjectCount(state)).toBe(2);
  });

  it('batch replace selects all marquee hits', () => {
    const r = nextObjectSelectionBatch(['a', 'b', 'c'], 'replace', []);
    expect(r.selectedIds).toEqual(['a', 'b', 'c']);
    expect(r.selectedId).toBe('c');
  });
});
