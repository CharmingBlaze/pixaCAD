import { describe, expect, it } from 'vitest';
import { applyObjectInteractiveTransform, captureObjectInteractiveSession } from './objectInteractiveTransform.js';

describe('objectInteractiveTransform', () => {
  const objects = [
    {
      id: 'a',
      name: 'Cube',
      parentId: null,
      isGroup: false,
      mesh: null,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      textureDataUrl: null,
      textureLayers: [],
      visible: true,
      locked: false,
    },
  ];

  it('captures and scales a root object from its pivot', () => {
    const session = captureObjectInteractiveSession(objects, ['a']);
    expect(session?.objectIds).toEqual(['a']);

    const scaled = applyObjectInteractiveTransform(objects, session, {
      mode: 'scale',
      scaleFactor: 2,
    });
    expect(scaled[0].scale).toEqual([2, 2, 2]);
  });

  it('translates multiple objects together', () => {
    const two = [
      ...objects,
      {
        id: 'b',
        name: 'Cube B',
        parentId: null,
        isGroup: false,
        mesh: null,
        position: [2, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureDataUrl: null,
        textureLayers: [],
        visible: true,
        locked: false,
      },
    ];
    const session = captureObjectInteractiveSession(two, ['a', 'b']);
    const moved = applyObjectInteractiveTransform(two, session, {
      mode: 'translate',
      worldDelta: [0, 1, 0],
    });
    expect(moved[0].position).toEqual([0, 1, 0]);
    expect(moved[1].position).toEqual([2, 1, 0]);
  });
});
