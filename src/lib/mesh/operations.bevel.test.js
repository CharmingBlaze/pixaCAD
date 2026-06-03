import { describe, expect, it } from 'vitest';
import { EditableMesh } from './EditableMesh.js';
import { bevelEdges } from './operations.js';

describe('bevelEdges', () => {
  const quad = () =>
    new EditableMesh({
      name: 'Quad',
      positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
      faces: [[0, 1, 2, 3]],
    });

  it('inserts bevel faces for a boundary edge', () => {
    const mesh = quad();
    const out = bevelEdges(mesh, ['0_1'], 0.2);
    expect(out.faceIndices.length).toBeGreaterThan(0);
    expect(out.mesh.faceCount).toBeGreaterThan(mesh.faceCount);
    expect(out.mesh.vertexCount).toBeGreaterThan(mesh.vertexCount);
  });

  it('adds more vertices with more segments', () => {
    const mesh = quad();
    const one = bevelEdges(mesh, ['0_1'], 0.25, '#888888', 1);
    const three = bevelEdges(mesh, ['0_1'], 0.25, '#888888', 3);
    expect(three.mesh.vertexCount).toBeGreaterThan(one.mesh.vertexCount);
    expect(three.mesh.faceCount).toBeGreaterThan(one.mesh.faceCount);
  });

  it('returns bevel edge keys on the chamfer', () => {
    const mesh = quad();
    const out = bevelEdges(mesh, ['0_1'], 0.2, '#888888', 2);
    expect(out.edgeKeys.length).toBeGreaterThan(0);
    for (const key of out.edgeKeys) {
      expect(key).toMatch(/^\d+_\d+$/);
    }
  });
});
