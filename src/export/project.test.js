import { describe, expect, it } from 'vitest';
import { APP_ID } from '../lib/brand.js';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { normalizeLoadedProject, projectSnapshot } from './project.js';

describe('project save/load', () => {
  it('round-trips a minimal scene', () => {
    const mesh = new EditableMesh({
      name: 'Box',
      positions: [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5],
      faces: [[0, 1, 2, 3]],
    });
    const state = {
      objects: [
        {
          id: 'obj1',
          name: 'Box_1',
          parentId: null,
          isGroup: false,
          mesh,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureDataUrl: null,
          visible: true,
          locked: false,
        },
      ],
      selectedId: 'obj1',
      editMode: 'vertex',
      transformMode: 'translate',
      selectedVertices: [0],
      selectedEdges: [],
      selectedFaces: [],
      paintColor: '#4889C7',
      renderMode: 'textured',
      viewportLayoutMode: 'quad',
      referenceImagesByView: {},
      snapGrid: true,
      gridSize: 0.01,
      showWireframe: true,
      showXRay: false,
      showGrid: true,
      activeViewport: 'perspective',
      gizmoAxisLock: null,
    };

    const snap = projectSnapshot(state);
    expect(snap.app).toBe(APP_ID);
    const loaded = normalizeLoadedProject(snap);

    expect(loaded.objects).toHaveLength(1);
    expect(loaded.selectedId).toBe('obj1');
    expect(loaded.editMode).toBe('vertex');
    expect(loaded.selectedVertices).toEqual([0]);
    expect(loaded.snapGrid).toBe(true);
    expect(loaded.gridSize).toBe(0.01);
    expect(loaded.objects[0].mesh?.faceCount).toBe(1);
  });

  it('defaults invalid edit mode to object', () => {
    const loaded = normalizeLoadedProject({
      objects: [],
      editMode: 'invalid',
    });
    expect(loaded.editMode).toBe('object');
  });
});

describe('loadProjectFile', () => {
  it('rejects wrong app id', async () => {
    const { loadProjectFile } = await import('./project.js');
    const file = new File([JSON.stringify({ app: 'other', objects: [] })], 'x.khed.json', {
      type: 'application/json',
    });
    await expect(loadProjectFile(file)).rejects.toThrow(/not a pixaCAD project/i);
  });

  it('accepts legacy khed-clone app id', async () => {
    const { loadProjectFile } = await import('./project.js');
    const file = new File(
      [JSON.stringify({ app: 'khed-clone', version: 2, objects: [] })],
      'legacy.khed.json',
      { type: 'application/json' },
    );
    const loaded = await loadProjectFile(file);
    expect(loaded.objects).toEqual([]);
  });
});
