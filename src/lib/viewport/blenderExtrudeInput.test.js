import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  extrudeDistanceFromPointer,
  extrudeWheelStep,
  worldNormalScreenDirection,
} from './blenderExtrudeInput.js';

describe('blenderExtrudeInput', () => {
  it('maps vertical drag to distance when normal is edge-on to camera', () => {
    const dist = extrudeDistanceFromPointer({
      startClientX: 100,
      startClientY: 200,
      clientX: 100,
      clientY: 100,
      startDistance: 0,
      screenDir: { x: 0, y: -1, magnitude: 0 },
      worldExtent: 2,
      shiftKey: false,
    });
    expect(dist).toBeCloseTo(0.3, 2);
  });

  it('shift reduces pointer sensitivity', () => {
    const coarse = extrudeDistanceFromPointer({
      startClientX: 0,
      startClientY: 0,
      clientX: 0,
      clientY: -100,
      startDistance: 0,
      screenDir: { x: 0, y: -1, magnitude: 0 },
      worldExtent: 2,
      shiftKey: false,
    });
    const fine = extrudeDistanceFromPointer({
      startClientX: 0,
      startClientY: 0,
      clientX: 0,
      clientY: -100,
      startDistance: 0,
      screenDir: { x: 0, y: -1, magnitude: 0 },
      worldExtent: 2,
      shiftKey: true,
    });
    expect(fine).toBeCloseTo(coarse * 0.1, 5);
  });

  it('projects movement along screen normal direction', () => {
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const anchor = new THREE.Vector3(0, 0, 0);
    const normal = new THREE.Vector3(0, 1, 0);
    const screenDir = worldNormalScreenDirection(normal, anchor, camera, {
      width: 800,
      height: 600,
    });
    expect(screenDir.magnitude).toBeGreaterThan(10);

    const dist = extrudeDistanceFromPointer({
      startClientX: 400,
      startClientY: 400,
      clientX: 400,
      clientY: 200,
      startDistance: 0,
      screenDir,
      worldExtent: 2,
    });
    expect(dist).toBeGreaterThan(0);
  });

  it('wheel step scales with mesh extent', () => {
    expect(extrudeWheelStep(2)).toBeCloseTo(0.08);
    expect(extrudeWheelStep(2, true)).toBeCloseTo(0.008);
  });
});
