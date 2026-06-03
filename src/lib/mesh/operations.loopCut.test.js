import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { loopCutEdges, loopCutFactors } from './operations.js';

describe('loopCutEdges', () => {
  it('splits a quad ring at 50%', () => {
    const mesh = new EditableMesh({
      name: 'Box',
      positions: [
        -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5,
        -0.5, 1, -0.5, 0.5, 1, -0.5, 0.5, 1, 0.5, -0.5, 1, 0.5,
      ],
      faces: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [0, 4, 5, 1],
        [1, 5, 6, 2],
        [2, 6, 7, 3],
        [3, 7, 4, 0],
      ],
    });

    const ring = ['1_5'];
    const out = loopCutEdges(mesh, ring, 0.5);
    expect(out.cutFaces).toBeGreaterThan(0);
    expect(out.mesh.faceCount).toBeGreaterThan(mesh.faceCount);
  });

  it('supports multiple evenly spaced cuts', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
      faces: [[0, 1, 2, 3]],
    });
    const factors = loopCutFactors(3, 0.5);
    expect(factors).toHaveLength(3);
    const out = loopCutEdges(mesh, ['0_1'], factors);
    expect(out.mesh.faces.length).toBe(4);
  });
});
