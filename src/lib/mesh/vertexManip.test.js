import { describe, expect, it } from 'vitest';
import { rotatePositionsFromPivot, scalePositionsFromPivot, snapVertexDelta } from './vertexManip.js';

describe('snapVertexDelta', () => {
  it('returns delta unchanged when snap is off', () => {
    expect(snapVertexDelta([0.13, 0, 0], false, 1)).toEqual([0.13, 0, 0]);
  });

  it('snaps each axis to grid', () => {
    const [x, y, z] = snapVertexDelta([0.13, 0.27, -0.11], true, 0.25);
    expect(x).toBe(0.25);
    expect(y).toBe(0.25);
    expect(z).toBeCloseTo(0, 5);
  });

  it('allows fine vertex snap step', () => {
    expect(snapVertexDelta([0.017, 0, 0], true, 0.01)).toEqual([0.02, 0, 0]);
  });
});

describe('scalePositionsFromPivot', () => {
  it('scales offsets from pivot uniformly', () => {
    const pivot = [0, 0, 0];
    const positions = [
      [1, 0, 0],
      [0, 2, 0],
    ];
    expect(scalePositionsFromPivot(positions, pivot, 2)).toEqual([
      [2, 0, 0],
      [0, 4, 0],
    ]);
  });
});

describe('rotatePositionsFromPivot', () => {
  it('rotates 90° around Y', () => {
    const out = rotatePositionsFromPivot([[1, 0, 0]], [0, 0, 0], [0, 1, 0], Math.PI / 2);
    expect(out[0][0]).toBeCloseTo(0, 5);
    expect(out[0][2]).toBeCloseTo(-1, 5);
  });
});
