import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  scaleFactorFromPointer,
  scaleWheelMultiplierStep,
  worldAxisScreenDirection,
} from './blenderScaleInput.js';

describe('scaleFactorFromPointer', () => {
  it('increases when dragging away from pivot along the initial direction', () => {
    const factor = scaleFactorFromPointer({
      pivotX: 100,
      pivotY: 100,
      startX: 120,
      startY: 100,
      clientX: 140,
      clientY: 100,
    });
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeCloseTo(2, 4);
  });

  it('decreases when dragging back toward the pivot', () => {
    const factor = scaleFactorFromPointer({
      pivotX: 100,
      pivotY: 100,
      startX: 140,
      startY: 100,
      clientX: 120,
      clientY: 100,
    });
    expect(factor).toBeLessThan(1);
    expect(factor).toBeCloseTo(0.5, 4);
  });

  it('ignores perpendicular motion (Blender-style constraint line)', () => {
    const along = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 100,
      startY: 0,
      clientX: 200,
      clientY: 0,
    });
    const sideways = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 100,
      startY: 0,
      clientX: 100,
      clientY: 200,
    });
    expect(along).toBeGreaterThan(1.5);
    expect(sideways).toBeCloseTo(1, 4);
  });

  it('shift reduces sensitivity', () => {
    const coarse = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 50,
      startY: 0,
      clientX: 150,
      clientY: 0,
      shiftKey: false,
    });
    const fine = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 50,
      startY: 0,
      clientX: 150,
      clientY: 0,
      shiftKey: true,
    });
    expect(fine).toBeCloseTo(1 + (coarse - 1) * 0.1, 5);
  });

  it('applies wheel multiplier', () => {
    const base = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 50,
      startY: 0,
      clientX: 100,
      clientY: 0,
    });
    const withWheel = scaleFactorFromPointer({
      pivotX: 0,
      pivotY: 0,
      startX: 50,
      startY: 0,
      clientX: 100,
      clientY: 0,
      wheelMultiplier: 1.5,
    });
    expect(withWheel).toBeCloseTo(base * 1.5, 5);
  });
});

describe('computeObjectsWorldExtent', () => {
  it('uses mesh.vertexCount without throwing', async () => {
    const { computeObjectsWorldExtent } = await import('./blenderScaleInput.js');
    const objects = [
      {
        id: 'a',
        parentId: null,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        mesh: {
          positions: [0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2],
          getPosition(i) {
            const o = i * 3;
            return [this.positions[o], this.positions[o + 1], this.positions[o + 2]];
          },
          get vertexCount() {
            return this.positions.length / 3;
          },
        },
      },
    ];
    expect(computeObjectsWorldExtent(objects, ['a'])).toBeGreaterThan(0);
  });
});

describe('scaleWheelMultiplierStep', () => {
  it('returns a value above 1 for positive extent', () => {
    expect(scaleWheelMultiplierStep(2)).toBeGreaterThan(1);
    expect(scaleWheelMultiplierStep(2, true)).toBeLessThan(scaleWheelMultiplierStep(2));
  });
});

describe('worldAxisScreenDirection', () => {
  it('yields a usable screen axis for X lock', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(2, 2, 2);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const dir = worldAxisScreenDirection([1, 0, 0], new THREE.Vector3(0, 0, 0), camera, {
      width: 800,
      height: 600,
    });
    expect(dir.magnitude).toBeGreaterThan(5);
  });
});
