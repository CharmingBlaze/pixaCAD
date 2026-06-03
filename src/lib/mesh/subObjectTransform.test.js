import { describe, expect, it } from 'vitest';
import {
  rotatePositionsInViewSpace,
  rotateAngleFromPivotScreen,
  advanceRotateAngleFromPointer,
  scaleFactorFromPivotScreen,
  ROTATE_MOUSE_GAIN,
} from './subObjectTransform.js';

describe('rotatePositionsInViewSpace', () => {
  const object = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    parentId: null,
  };

  it('rotates around view Z through world pivot', () => {
    const out = rotatePositionsInViewSpace(
      [[1, 0, 0]],
      [0, 0, 0],
      object,
      [object],
      [0, 0, -1],
      Math.PI / 2,
    );
    expect(out[0][0]).toBeCloseTo(0, 4);
    expect(out[0][1]).toBeCloseTo(-1, 4);
  });
});

describe('scaleFactorFromPivotScreen', () => {
  it('increases when the cursor moves away from the pivot along the drag line', () => {
    const factor = scaleFactorFromPivotScreen(100, 100, 120, 100, 140, 100);
    expect(factor).toBeGreaterThan(1);
    expect(factor).toBeCloseTo(2, 4);
  });

  it('decreases when the cursor moves toward the pivot', () => {
    const factor = scaleFactorFromPivotScreen(100, 100, 140, 100, 120, 100);
    expect(factor).toBeLessThan(1);
    expect(factor).toBeCloseTo(0.5, 4);
  });

  it('supports both directions when the cursor starts on the pivot', () => {
    const away = scaleFactorFromPivotScreen(100, 100, 100, 100, 120, 100);
    const toward = scaleFactorFromPivotScreen(100, 100, 120, 100, 100, 100);
    expect(away).toBeGreaterThan(1);
    expect(toward).toBeLessThan(1);
  });
});

describe('rotateAngleFromPivotScreen', () => {
  it('uses pivot-centered angle, not raw horizontal delta', () => {
    const angle = rotateAngleFromPivotScreen(0, 0, 10, 0, 0, 10);
    expect(Math.abs(angle)).toBeGreaterThan(0.1);
  });
});

describe('advanceRotateAngleFromPointer', () => {
  it('accumulates a full 360° orbit without reversing', () => {
    const pivotX = 200;
    const pivotY = 200;
    const radius = 80;
    let prev = null;
    let accumulated = 0;

    for (let i = 0; i <= 12; i += 1) {
      const deg = i * 30;
      const rad = (deg * Math.PI) / 180;
      const x = pivotX + radius * Math.cos(rad);
      const y = pivotY + radius * Math.sin(rad);
      const orbit = advanceRotateAngleFromPointer(pivotX, pivotY, x, y, prev, accumulated);
      prev = orbit.pointerAngle;
      accumulated = orbit.accumulatedAngle;
    }

    expect(accumulated).toBeCloseTo(Math.PI * 2 * ROTATE_MOUSE_GAIN, 3);
    expect(accumulated).toBeGreaterThan(0);
  });

  it('ignores pointer samples on top of the pivot', () => {
    const result = advanceRotateAngleFromPointer(100, 100, 100, 100, 0.5, 1.2);
    expect(result.skipped).toBe(true);
    expect(result.accumulatedAngle).toBe(1.2);
  });
});
