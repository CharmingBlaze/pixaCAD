import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';

describe('EditableMesh.toBufferGeometry', () => {
  it('triangulates multiple faces with distinct UVs per face index', () => {
    const mesh = new EditableMesh({
      name: 'Multi',
      positions: [
        0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
        2, 0, 0, 3, 0, 0, 3, 1, 0, 2, 1, 0,
      ],
      faces: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
      ],
      faceColors: ['#ff0000', '#0000ff'],
      faceUVs: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        [
          [0.25, 0.25],
          [0.75, 0.25],
          [0.75, 0.75],
          [0.25, 0.75],
        ],
      ],
    });

    const geom = mesh.toBufferGeometry();
    const uv = geom.getAttribute('uv');
    expect(uv.count).toBe(12);
    const uvArray = Array.from(uv.array);
    expect(uvArray.slice(0, 4)).toEqual([0, 0, 1, 0]);
    const secondFaceStart = 6 * 2;
    expect(uvArray.slice(secondFaceStart, secondFaceStart + 4)).toEqual([0.25, 0.25, 0.75, 0.25]);
    geom.dispose();
  });
});
