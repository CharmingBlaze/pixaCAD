import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { addFace, extrudeEdges, extrudeFaces, flipFaceNormals, mirrorMesh, splitEdges, subdivideFaces } from './operations.js';

function triangleInwardCount(mesh) {
  const center = mesh.getMeshCentroid();
  let inward = 0;
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    for (let i = 1; i < face.length - 1; i++) {
      const a = mesh.getPosition(face[0]);
      const b = mesh.getPosition(face[i]);
      const c = mesh.getPosition(face[i + 1]);
      const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const normal = [
        ab[1] * ac[2] - ab[2] * ac[1],
        ab[2] * ac[0] - ab[0] * ac[2],
        ab[0] * ac[1] - ab[1] * ac[0],
      ];
      const faceCenter = [
        (a[0] + b[0] + c[0]) / 3,
        (a[1] + b[1] + c[1]) / 3,
        (a[2] + b[2] + c[2]) / 3,
      ];
      const outward = [faceCenter[0] - center.x, faceCenter[1] - center.y, faceCenter[2] - center.z];
      if (normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] < -1e-8) inward++;
    }
  }
  return inward;
}

function cubeMesh() {
  return new EditableMesh({
    name: 'Cube',
    positions: [
      -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
      -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    ],
    faces: [
      [0, 1, 2, 3],
      [4, 7, 6, 5],
      [0, 4, 5, 1],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [4, 0, 3, 7],
    ],
  });
}

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

describe('operation face winding', () => {
  it('keeps generated modeling faces outward', () => {
    const cube = cubeMesh();
    expect(triangleInwardCount(cube)).toBe(0);
    expect(triangleInwardCount(extrudeFaces(cube, [0], 0.5))).toBe(0);
    expect(triangleInwardCount(addFace(cube, [0, 4, 5, 1]))).toBe(0);
    expect(triangleInwardCount(splitEdges(cube, ['0_1']))).toBe(0);
    expect(triangleInwardCount(subdivideFaces(cube, [0]))).toBe(0);
  });

  it('lets flip normals intentionally reverse selected faces and their UVs', () => {
    const cube = cubeMesh();
    const before = cube.faces[0];
    const beforeUvs = cube.faceUVs[0];
    const out = flipFaceNormals(cube, [0]);

    expect(out.faces[0]).toEqual([...before].reverse());
    expect(out.faceUVs[0]).toEqual([...beforeUvs].reverse());
    expect(triangleInwardCount(out)).toBe(2);
  });
});
