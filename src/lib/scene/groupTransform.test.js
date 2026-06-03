import { describe, expect, it } from 'vitest';
import { EditableMesh } from '../mesh/EditableMesh.js';
import { computeGroupPivot, computeSelectionGeometryPivotWorld } from './groupTransform.js';

describe('computeSelectionGeometryPivotWorld', () => {
  it('uses mesh vertex centroid instead of object origin', () => {
    const mesh = new EditableMesh({
      name: 'OffCenter',
      positions: [2, 0, 0, 4, 0, 0, 3, 2, 0],
      faces: [[0, 1, 2]],
      faceColors: ['#fff'],
    });
    const objects = [
      {
        id: 'a',
        name: 'Mesh',
        parentId: null,
        isGroup: false,
        mesh,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ];

    const originPivot = computeGroupPivot(objects, objects);
    const geometryPivot = computeSelectionGeometryPivotWorld(objects, objects);

    expect(originPivot).toEqual([0, 0, 0]);
    expect(geometryPivot[0]).toBeCloseTo(3, 4);
    expect(geometryPivot[1]).toBeCloseTo(2 / 3, 4);
  });
});
