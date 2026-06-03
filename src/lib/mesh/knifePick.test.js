import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PRIMITIVES } from './primitives.js';
import { localPointOnFace, resolveKnifeFaceIndex } from './knifePick.js';

describe('localPointOnFace', () => {
  const mesh = PRIMITIVES.cube.create();
  const frontFace = 1;

  it('accepts interior and boundary points on the face', () => {
    expect(localPointOnFace(mesh, frontFace, [0, 0, 0.5])).toBe(true);
    expect(localPointOnFace(mesh, frontFace, mesh.getPosition(7))).toBe(true);
    expect(localPointOnFace(mesh, frontFace, [-0.5, 0, 0.5])).toBe(true);
  });

  it('rejects points on a different face plane', () => {
    expect(localPointOnFace(mesh, frontFace, mesh.getPosition(0))).toBe(false);
  });
});

describe('resolveKnifeFaceIndex', () => {
  const mesh = PRIMITIVES.cube.create();

  it('keeps the active face when the picked point lies on it', () => {
    const active = 1;
    const point = mesh.getPosition(7);
    expect(resolveKnifeFaceIndex(mesh, active, 5, point)).toBe(active);
  });
});

describe('hitFacePoint preferFaceIndex', () => {
  it('prefers the active face when the ray hits it', async () => {
    const { hitFacePoint } = await import('./knifePick.js');
    const mesh = PRIMITIVES.cube.create();
    const ray = new THREE.Ray(new THREE.Vector3(0, 0, 2), new THREE.Vector3(0, 0, -1));
    const hit = hitFacePoint(mesh, ray, { preferFaceIndex: 1 });
    expect(hit?.faceIndex).toBe(1);
  });
});
