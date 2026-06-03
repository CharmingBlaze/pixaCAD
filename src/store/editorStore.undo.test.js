import { beforeEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editorStore.js';

describe('editorStore undo/redo', () => {
  beforeEach(() => {
    useEditorStore.getState().newScene();
  });

  it('restores face paint after undo and redo', () => {
    const store = useEditorStore.getState();
    store.addPrimitive('cube');
    const id = useEditorStore.getState().objects[0].id;
    store.selectObject(id);
    store.setEditMode('face');
    store.selectFace(0, 'replace');
    const before = useEditorStore.getState().objects[0].mesh.faceColors[0];
    useEditorStore.setState({ paintColor: '#ff0066' });
    store.applyPaintToSelection();
    expect(useEditorStore.getState().objects[0].mesh.faceColors[0]).toBe('#ff0066');
    expect(useEditorStore.getState().canUndo).toBe(true);

    store.undo();
    expect(useEditorStore.getState().objects[0].mesh.faceColors[0]).toBe(before);
    expect(useEditorStore.getState().canRedo).toBe(true);

    store.redo();
    expect(useEditorStore.getState().objects[0].mesh.faceColors[0]).toBe('#ff0066');
  });

  it('restores mesh topology after extrude undo', () => {
    const store = useEditorStore.getState();
    store.addPrimitive('cube');
    const id = useEditorStore.getState().objects[0].id;
    store.selectObject(id);
    store.setEditMode('face');
    store.selectFace(0, 'replace');
    const beforeFaces = useEditorStore.getState().objects[0].mesh.faceCount;

    store.startExtrudeSession();
    store.updateExtrudeDistance(0.5);
    store.confirmExtrudeSession();
    expect(useEditorStore.getState().objects[0].mesh.faceCount).toBeGreaterThan(beforeFaces);

    store.undo();
    expect(useEditorStore.getState().objects[0].mesh.faceCount).toBe(beforeFaces);
  });
});
