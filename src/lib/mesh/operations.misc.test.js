import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { extrudeEdges, mirrorMesh, splitEdges, subdivideFaces } from './operations.js';

describe('mirrorMesh', () => {
  it('duplicates geometry mirrored across X', () => {
    const mesh = new EditableMesh({
      name: 'Tri',
      positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
      faces: [[0, 1, 2]],
      faceColors: ['#ffffff'],
    });
    const out = mirrorMesh(mesh, 'x');
    expect(out.vertexCount).toBe(6);
    expect(out.faceCount).toBe(2);
    expect(out.getPosition(3)[0]).toBeCloseTo(0, 5);
    expect(out.getPosition(4)).toEqual([-1, 0, 0]);
  });
});

describe('subdivideFaces', () => {
  it('splits a quad into four quads', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      faces: [[0, 1, 2, 3]],
      faceColors: ['#ffffff'],
    });
    const out = subdivideFaces(mesh, [0]);
    expect(out.faceCount).toBe(4);
    expect(out.vertexCount).toBeGreaterThan(mesh.vertexCount);
  });
});

describe('splitEdges', () => {
  it('inserts midpoints on selected edges', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      faces: [[0, 1, 2, 3]],
      faceColors: ['#ffffff'],
    });
    const out = splitEdges(mesh, ['0_1']);
    expect(out.vertexCount).toBe(mesh.vertexCount + 1);
    expect(out.faces[0].length).toBe(5);
  });
});

describe('extrudeEdges', () => {
  it('creates bridge quads for selected edges', () => {
    const mesh = new EditableMesh({
      name: 'Quad',
      positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
      faces: [[0, 1, 2, 3]],
      faceColors: ['#ffffff'],
    });
    const { mesh: out, edgeKeys } = extrudeEdges(mesh, ['0_1']);
    expect(out.faceCount).toBe(mesh.faceCount + 1);
    expect(edgeKeys.length).toBe(1);
    expect(out.vertexCount).toBe(mesh.vertexCount + 2);
  });
});
