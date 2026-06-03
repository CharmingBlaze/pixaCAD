import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeObjectsWorldBounds,
  frameTargetObjectIds,
  frameViewportCamera,
  resetViewportCamera,
} from './viewportCamera.js';

describe('viewportCamera', () => {
  const objects = [
    {
      id: 'cube',
      name: 'Cube',
      parentId: null,
      isGroup: false,
      visible: true,
      locked: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      mesh: {
        positions: [-1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1],
        vertexCount: 4,
        faceCount: 1,
      },
    },
  ];

  it('frames selected objects before whole scene', () => {
    const state = {
      objects,
      selectedId: 'cube',
      selectedIds: ['cube'],
    };
    expect(frameTargetObjectIds(state)).toEqual(['cube']);
  });

  it('computes world bounds from mesh vertices', () => {
    const box = computeObjectsWorldBounds(objects, ['cube']);
    expect(box).not.toBeNull();
    expect(box.min.x).toBeCloseTo(-1);
    expect(box.max.x).toBeCloseTo(1);
  });

  it('resets perspective camera to defaults', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(9, 9, 9);
    const target = new THREE.Vector3(3, 3, 3);
    const controls = { target, update: () => {} };
    resetViewportCamera(camera, controls, 'perspective');
    expect(camera.position.toArray()).toEqual([4, 3.5, 5]);
    expect(target.toArray()).toEqual([0, 0, 0]);
  });

  it('frames perspective camera on bounds', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
    camera.position.set(4, 3.5, 5);
    const target = new THREE.Vector3();
    const controls = { target, update: () => {} };
    const box = computeObjectsWorldBounds(objects, ['cube']);
    frameViewportCamera(camera, controls, box, 'perspective');
    expect(target.x).toBeCloseTo(0);
    expect(camera.position.distanceTo(target)).toBeGreaterThan(1);
  });
});
