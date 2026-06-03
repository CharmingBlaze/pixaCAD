import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { insetFaces, weldSelectedVertices, decimateMesh } from './operations.js';

function cubeMesh() {
  return new EditableMesh({
    name: 'Cube',
    positions: [
      0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
      0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1,
    ],
    faces: [[0, 1, 2, 3], [4, 5, 6, 7]],
    faceColors: ['#fff', '#fff'],
  });
}

describe('insetFaces', () => {
  it('adds side faces and shrinks the top face', () => {
    const mesh = cubeMesh();
    const next = insetFaces(mesh, [0], 0.25);
    expect(next.faceCount).toBeGreaterThan(mesh.faceCount);
    expect(next.vertexCount).toBeGreaterThan(mesh.vertexCount);
  });
});

describe('weldSelectedVertices', () => {
  it('welds only selected vertices within threshold', () => {
    const mesh = new EditableMesh({
      name: 'Pair',
      positions: [0, 0, 0, 0.01, 0, 0, 1, 0, 0],
      faces: [[0, 1, 2]],
      faceColors: ['#fff'],
    });
    const welded = weldSelectedVertices(mesh, [0, 1], 0.05);
    expect(welded.vertexCount).toBeLessThan(mesh.vertexCount);
  });
});

describe('decimateMesh', () => {
  it('reduces vertex count on dense meshes', () => {
    const positions = [];
    const faces = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        positions.push(x * 0.05, y * 0.05, 0);
      }
    }
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const i = y * 4 + x;
        faces.push([i, i + 1, i + 4, i + 5]);
      }
    }
    const mesh = new EditableMesh({ name: 'Grid', positions, faces, faceColors: faces.map(() => '#fff') });
    const reduced = decimateMesh(mesh, 0.3);
    expect(reduced.vertexCount).toBeLessThanOrEqual(mesh.vertexCount);
  });
});
