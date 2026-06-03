import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { seamAwareUnwrap } from './uvSeamUnwrap.js';

describe('seamAwareUnwrap', () => {
  it('packs islands split by seam edges', () => {
    const mesh = new EditableMesh({
      name: 'Box',
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1],
      faces: [[0, 1, 2, 3], [0, 1, 5, 4]],
      faceColors: ['#fff', '#fff'],
      uvSeamEdges: ['1_5'],
    });
    const uvs = seamAwareUnwrap(mesh, [0, 1], ['1_5'], 0.02);
    expect(Object.keys(uvs).length).toBe(2);
    for (const faceUvs of Object.values(uvs)) {
      for (const [u, v] of faceUvs) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThanOrEqual(1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
