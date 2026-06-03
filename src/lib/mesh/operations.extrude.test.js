import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { extrudeFaces } from './operations.js';

describe('extrudeFaces', () => {
  it('keeps the base face so extrusion is a closed prism', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
      faces: [[0, 1, 2, 3]],
    });

    const out = extrudeFaces(mesh, [0], 1);
    expect(out.vertexCount).toBe(8);
    expect(out.faceCount).toBe(6);
    expect(out.faces[0]).toEqual([0, 1, 2, 3]);

    const base = out.getPosition(0);
    const top = out.getPosition(4);
    const dist = Math.hypot(top[0] - base[0], top[1] - base[1], top[2] - base[2]);
    expect(dist).toBeCloseTo(1, 5);
    for (const vi of [0, 1, 2, 3]) {
      expect(out.getPosition(vi)).toEqual(mesh.getPosition(vi));
    }
  });

  it('keeps the base when the extruded face shares edges with neighbors', () => {
    const mesh = new EditableMesh({
      name: 'TwoQuads',
      positions: [0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 2, 0, 0, 2, 0, 1],
      faces: [
        [0, 1, 2, 3],
        [1, 4, 5, 2],
      ],
    });

    const out = extrudeFaces(mesh, [0], 0.5);
    expect(out.faces[0]).toEqual([0, 1, 2, 3]);
    expect(out.faceCount).toBeGreaterThan(mesh.faceCount);
  });
});
