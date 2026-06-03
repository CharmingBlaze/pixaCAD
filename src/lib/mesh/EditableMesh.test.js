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

  it('normalizes inward stored faces while preserving vertex UV pairings', () => {
    const mesh = new EditableMesh({
      name: 'InwardFrontFace',
      positions: [
        -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
        -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      ],
      faces: [[4, 7, 6, 5]],
      faceUVs: [[
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0],
      ]],
    });

    expect(mesh.faces[0]).toEqual([5, 6, 7, 4]);
    expect(mesh.faceUVs[0]).toEqual([
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
    const geom = mesh.toBufferGeometry();
    const pos = geom.getAttribute('position');
    const uv = geom.getAttribute('uv');
    const a = [pos.getX(0), pos.getY(0), pos.getZ(0)];
    const b = [pos.getX(1), pos.getY(1), pos.getZ(1)];
    const c = [pos.getX(2), pos.getY(2), pos.getZ(2)];
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const normalZ = ab[0] * ac[1] - ab[1] * ac[0];

    expect(mesh.shouldReverseFaceWinding(0)).toBe(false);
    expect(normalZ).toBeGreaterThan(0);
    expect(Array.from(uv.array).slice(0, 6)).toEqual([1, 0, 1, 1, 0, 1]);
    geom.dispose();
  });
});
