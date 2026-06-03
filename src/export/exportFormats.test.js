import { describe, expect, it } from 'vitest';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { triangulateForExport } from '../lib/mesh/operations.js';

describe('export triangulation', () => {
  it('triangulates quads for STL/OBJ paths', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      faces: [[0, 1, 2, 3]],
      faceColors: ['#fff'],
    });
    const { faces } = triangulateForExport(mesh);
    expect(faces.length).toBe(2);
    expect(faces.every((f) => f.length === 3)).toBe(true);
  });
});
