import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  arrowWorldDelta,
  nudgeStepForMode,
  viewportScreenArrowDelta,
  worldAxisArrowDelta,
} from './viewportNudge.js';

describe('viewportNudge', () => {
  it('uses grid step for objects when snap is on', () => {
    expect(nudgeStepForMode('object', true, 0.25)).toBe(0.25);
    expect(nudgeStepForMode('vertex', true, 1)).toBe(0.01);
  });

  it('uses a smaller step when Shift is held', () => {
    expect(nudgeStepForMode('object', false, 1)).toBe(1);
    expect(nudgeStepForMode('object', false, 1, { shiftKey: true })).toBe(0.1);
    expect(nudgeStepForMode('object', true, 0.5, { shiftKey: true })).toBe(0.05);
  });

  it('maps world axes in perspective mode', () => {
    expect(worldAxisArrowDelta('ArrowUp', 1)).toEqual([0, 1, 0]);
    expect(worldAxisArrowDelta('ArrowRight', 2)).toEqual([2, 0, 0]);
    expect(worldAxisArrowDelta('ArrowUp', 0.1)).toEqual([0, 0.1, 0]);
    expect(worldAxisArrowDelta('ArrowLeft', 1, { axisLock: 'X' })).toEqual([-1, 0, 0]);
    expect(worldAxisArrowDelta('ArrowUp', 1, { axisLock: 'Z' })).toEqual([0, 0, 1]);
  });

  it('uses camera screen axes for ortho views', () => {
    const cam = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    cam.position.set(0, 24, 0);
    cam.up.set(0, 0, -1);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);

    const up = viewportScreenArrowDelta(cam, 'ArrowUp', 1);
    const right = viewportScreenArrowDelta(cam, 'ArrowRight', 1);

    expect(up[1]).toBeCloseTo(0, 4);
    expect(up[2]).toBeCloseTo(-1, 4);
    expect(right[0]).toBeCloseTo(1, 4);
  });

  it('picks world axes for perspective view id', () => {
    const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    cam.position.set(4, 3.5, 5);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld(true);

    const up = arrowWorldDelta(cam, 'ArrowUp', 1, { viewId: 'perspective' });
    expect(up).toEqual([0, 1, 0]);
  });
});
