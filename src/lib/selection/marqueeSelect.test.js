import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { EditableMesh } from '../mesh/EditableMesh.js';
import { pickObjectAt } from './marqueeSelect.js';

describe('pickObjectAt screen bounds fallback', () => {
  it('selects edge-on plane in ortho when face ray misses', () => {
    const mesh = new EditableMesh({
      name: 'Plane',
      positions: [-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1],
      faces: [[0, 1, 2, 3]],
    });
    const objects = [
      {
        id: 'plane',
        visible: true,
        isGroup: false,
        mesh,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parentId: null,
      },
    ];

    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
    camera.position.set(8, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const domRect = { left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 };
    const clientX = 200;
    const clientY = 200;
    const ndc = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);

    const faceOnly = pickObjectAt(objects, raycaster.ray);
    const withScreen = pickObjectAt(objects, raycaster.ray, {
      camera,
      clientX,
      clientY,
      domRect,
    });

    expect(faceOnly).toBeNull();
    expect(withScreen).toBe('plane');
  });
});
