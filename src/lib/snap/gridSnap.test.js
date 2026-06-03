import { describe, expect, it } from 'vitest';
import { objectSnapGrid, snapVector3Components, vertexSnapGrid } from './gridSnap.js';

describe('gridSnap', () => {
  it('snaps position components to grid', () => {
    expect(snapVector3Components(1.23, 2.49, 0.4, 1)).toEqual([1, 2, 0]);
  });

  it('uses full grid step for object snap', () => {
    expect(objectSnapGrid(true, 0.25)).toBe(0.25);
    expect(objectSnapGrid(true, 0)).toBe(1);
    expect(objectSnapGrid(false, 1)).toBe(0);
  });

  it('caps vertex snap to a fine step', () => {
    expect(vertexSnapGrid(true, 1)).toBe(0.01);
    expect(vertexSnapGrid(true, 0.005)).toBe(0.005);
    expect(vertexSnapGrid(false, 1)).toBe(0);
  });
});
