import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { saveBlob } from './fileSave.js';

function exportableMeshes(objects) {
  return objects.filter((o) => o.mesh && !o.isGroup && o.visible !== false);
}

/** @param {import('../store/editorStore.js').SceneObject[]} objects */
export async function exportSceneToSTL(objects) {
  const meshes = exportableMeshes(objects);
  if (meshes.length === 0) {
    throw new Error('No visible mesh objects to export');
  }
  const scene = new THREE.Scene();
  for (const obj of meshes) {
    const geometry = obj.mesh.toBufferGeometry();
    const material = new THREE.MeshStandardMaterial({ color: obj.mesh.faceColors[0] ?? '#c8b070' });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(obj.position);
    mesh.rotation.set(...obj.rotation);
    mesh.scale.fromArray(obj.scale);
    mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);
    scene.add(new THREE.Mesh(geometry, material));
  }
  const exporter = new STLExporter();
  const text = exporter.parse(scene);
  await saveBlob(new Blob([text], { type: 'model/stl' }), 'model.stl', 'STL mesh');
}
