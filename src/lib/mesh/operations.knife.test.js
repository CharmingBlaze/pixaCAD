import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { PRIMITIVES } from './primitives.js';
import { knifeCutFace } from './operations.js';

function quadMesh() {
  return new EditableMesh({
    name: 'Quad',
    positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
    faces: [[0, 1, 2, 3]],
  });
}

describe('knifeCutFace', () => {
  it('splits a quad into two faces when cut crosses opposite edges', () => {
    const mesh = quadMesh();
    const result = knifeCutFace(mesh, 0, [-0.4, 0, 0], [0.4, 0, 0]);
    expect(result.cut).toBe(true);
    expect(result.mesh.faceCount).toBe(2);
    expect(result.faceIndices).toHaveLength(2);
  });

  it('does not cut when both points are on the same edge', () => {
    const mesh = quadMesh();
    const result = knifeCutFace(mesh, 0, [-0.5, 0, -0.2], [-0.5, 0, 0.2]);
    expect(result.cut).toBe(false);
    expect(result.mesh.faceCount).toBe(1);
  });

  it('does not cut with identical points', () => {
    const mesh = quadMesh();
    const result = knifeCutFace(mesh, 0, [0, 0, 0], [0, 0, 0]);
    expect(result.cut).toBe(false);
  });

  it('splits a cube face corner to corner', () => {
    const mesh = PRIMITIVES.cube.create();
    const result = knifeCutFace(mesh, 1, mesh.getPosition(7), mesh.getPosition(5));
    expect(result.cut).toBe(true);
    expect(result.mesh.faceCount).toBe(7);
  });
});
