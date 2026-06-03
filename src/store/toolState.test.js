import { describe, expect, it } from 'vitest';
import {
  inactiveToolState,
  isPolyDrawEngaged,
  knifeFinishedState,
  normalizeStrandedEditMode,
  polyDrawContinuedPatch,
  polyDrawFinishedState,
  polyDrawSessionEndState,
  extrudeSessionEndState,
} from './toolState.js';
import { isInteractionBlocked, canViewportPickObject, shouldViewportSelectObject } from './interaction.js';

describe('toolState', () => {
  it('inactiveToolState clears all transient tools', () => {
    const s = inactiveToolState();
    expect(s.knifeActive).toBe(false);
    expect(s.polyDrawActive).toBe(false);
    expect(s.extrudeActive).toBe(false);
    expect(s.marqueeActive).toBe(false);
    expect(s.activeTool).toBe('select');
  });

  it('knifeFinishedState disables knife and keeps face selection', () => {
    const s = knifeFinishedState('obj1', [0, 1]);
    expect(s.knifeActive).toBe(false);
    expect(s.editMode).toBe('face');
    expect(s.selectedId).toBe('obj1');
    expect(s.selectedFaces).toEqual([0, 1]);
  });

  it('polyDrawFinishedState returns to object mode', () => {
    const s = polyDrawFinishedState('obj1');
    expect(s.polyDrawActive).toBe(false);
    expect(s.editMode).toBe('object');
    expect(s.transformMode).toBe('translate');
    expect(s.selectedId).toBe('obj1');
  });

  it('polyDrawContinuedPatch keeps poly draw active in vertex mode', () => {
    const s = polyDrawContinuedPatch('obj1', 'Added face');
    expect(s.polyDrawActive).toBe(true);
    expect(s.activeTool).toBe('polyDraw');
    expect(s.editMode).toBe('vertex');
    expect(s.polyDrawVerts).toEqual([]);
    expect(s.selectedId).toBe('obj1');
  });

  it('polyDrawSessionEndState keeps added faces when ending on an existing mesh', () => {
    const baseMesh = { faceCount: 2, clone: () => baseMesh };
    const editedMesh = { faceCount: 4 };
    const objects = [{ id: 'obj1', mesh: editedMesh }];
    const end = polyDrawSessionEndState(objects, {
      polyDrawTargetId: 'obj1',
      polyDrawBaseMesh: baseMesh,
      polyDrawCreatedObject: false,
      polyDrawRevertOnCancel: true,
      meshRevision: 1,
      selectedId: 'obj1',
    });
    expect(end.objects[0].mesh).toBe(editedMesh);
    expect(end.polyDrawActive).toBe(false);
    expect(end.editMode).toBe('object');
    expect(end.selectedId).toBe('obj1');
  });

  it('isPolyDrawEngaged when active flag or leftover session', () => {
    expect(isPolyDrawEngaged({ polyDrawActive: true })).toBe(true);
    expect(isPolyDrawEngaged({ polyDrawActive: false, polyDrawTargetId: 'obj1' })).toBe(true);
    expect(isPolyDrawEngaged({ polyDrawActive: false, activeTool: 'polyDraw' })).toBe(true);
    expect(isPolyDrawEngaged({ polyDrawActive: false, activeTool: 'select' })).toBe(false);
  });

  it('polyDrawSessionEndState clears limbo when target id missing', () => {
    const end = polyDrawSessionEndState([], {
      polyDrawTargetId: null,
      activeTool: 'polyDraw',
      polyDrawActive: false,
      meshRevision: 0,
      selectedId: null,
    });
    expect(end.polyDrawActive).toBe(false);
    expect(end.activeTool).toBe('select');
    expect(end.editMode).toBe('object');
    expect(end.polyDrawTargetId).toBeNull();
  });

  it('isInteractionBlocked when knife or poly active', () => {
    expect(isInteractionBlocked({ knifeActive: true })).toBe(true);
    expect(isInteractionBlocked({ polyDrawActive: true })).toBe(true);
    expect(isInteractionBlocked({ polyDrawActive: false, activeTool: 'polyDraw' })).toBe(true);
    expect(isInteractionBlocked({ knifeActive: false, polyDrawActive: false })).toBe(false);
  });

  it('canViewportPickObject allows pick while poly draw or vertex mode is active', () => {
    expect(canViewportPickObject({ editMode: 'vertex', polyDrawActive: true })).toBe(true);
    expect(canViewportPickObject({ pendingPrimitive: 'cube' })).toBe(false);
    expect(canViewportPickObject({ extrudeActive: true })).toBe(false);
    expect(canViewportPickObject({ knifeActive: true })).toBe(false);
  });

  it('shouldViewportSelectObject only in object mode', () => {
    expect(shouldViewportSelectObject({ editMode: 'object' })).toBe(true);
    expect(shouldViewportSelectObject({ editMode: 'face' })).toBe(false);
    expect(shouldViewportSelectObject({ editMode: 'object', extrudeActive: true })).toBe(false);
  });

  it('normalizeStrandedEditMode returns to object mode without a mesh target', () => {
    expect(
      normalizeStrandedEditMode({
        editMode: 'vertex',
        activeTool: 'select',
        polyDrawActive: false,
        polyDrawTargetId: null,
        selectedId: null,
        objects: [],
      }),
    ).toMatchObject({ editMode: 'object' });
  });

  it('normalizeStrandedEditMode keeps intentional vertex mode on a mesh', () => {
    expect(
      normalizeStrandedEditMode({
        editMode: 'vertex',
        activeTool: 'select',
        polyDrawActive: false,
        polyDrawTargetId: null,
        selectedId: 'obj1',
        objects: [{ id: 'obj1', mesh: {}, isGroup: false }],
      }),
    ).toEqual({});
  });

  it('cancelPolyDraw end patch always returns to object mode', () => {
    const end = polyDrawSessionEndState([], {
      polyDrawTargetId: null,
      activeTool: 'select',
      polyDrawActive: false,
      meshRevision: 0,
      selectedId: null,
      editMode: 'vertex',
    });
    expect(end.editMode).toBe('object');
    expect(end.activeTool).toBe('select');
  });

  it('extrudeSessionEndState keeps face mode and selection', () => {
    const end = extrudeSessionEndState({
      selectedId: 'obj1',
      editMode: 'face',
      extrudeFaceIndices: [0, 2],
    });
    expect(end.extrudeActive).toBe(false);
    expect(end.editMode).toBe('face');
    expect(end.selectedFaces).toEqual([0, 2]);
  });
});
