import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { uid } from '../lib/id.js';
import { readFileDataUrl, safeName, saveBlob } from './fileSave.js';

function dataUrlTexture(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

function exportableMeshes(objects) {
  return objects.filter((o) => o.mesh && !o.isGroup && o.visible !== false);
}

async function buildExportScene(objects) {
  const meshes = exportableMeshes(objects);
  if (meshes.length === 0) {
    throw new Error('No visible mesh objects to export');
  }
  const scene = new THREE.Scene();
  const nodeById = new Map();
  for (const obj of objects) {
    if (obj.visible === false) continue;
    if (obj.isGroup) {
      const group = new THREE.Group();
      group.name = safeName(obj.name, 'Group');
      group.position.fromArray(obj.position);
      group.rotation.set(...obj.rotation);
      group.scale.fromArray(obj.scale);
      nodeById.set(obj.id, group);
      continue;
    }
    if (!obj.mesh) continue;
    const geometry = obj.mesh.toBufferGeometry();
    const texture = await dataUrlTexture(obj.textureDataUrl);
    const material = texture
      ? new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.001 })
      : new THREE.MeshStandardMaterial({ color: obj.mesh.faceColors[0] ?? '#c8b070', roughness: 0.8 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = safeName(obj.name, 'Object');
    mesh.position.fromArray(obj.position);
    mesh.rotation.set(...obj.rotation);
    mesh.scale.fromArray(obj.scale);
    nodeById.set(obj.id, mesh);
  }
  for (const obj of objects) {
    const node = nodeById.get(obj.id);
    if (!node) continue;
    const parent = obj.parentId ? nodeById.get(obj.parentId) : scene;
    (parent ?? scene).add(node);
  }
  if (scene.children.length === 0) {
    throw new Error('No visible mesh objects to export');
  }
  return scene;
}

/** @param {import('../store/editorStore.js').SceneObject[]} objects */
export async function exportSceneToGLTF(objects) {
  const scene = await buildExportScene(objects);
  const exporter = new GLTFExporter();
  const result = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: false, embedImages: true, forcePowerOfTwoTextures: false });
  });
  const text = JSON.stringify(result, null, 2);
  await saveBlob(new Blob([text], { type: 'model/gltf+json' }), 'model.gltf', 'glTF scene');
}

/** @param {import('../store/editorStore.js').SceneObject[]} objects */
export async function exportSceneToGLB(objects) {
  const scene = await buildExportScene(objects);
  const exporter = new GLTFExporter();
  const result = await new Promise((resolve, reject) => {
    exporter.parse(scene, resolve, reject, { binary: true, embedImages: true, forcePowerOfTwoTextures: false });
  });
  await saveBlob(new Blob([result], { type: 'model/gltf-binary' }), 'model.glb', 'GLB scene');
}

function imageToDataUrl(image) {
  if (!image) return null;
  if (typeof image.src === 'string' && image.src.startsWith('data:')) return image.src;
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width || 1;
  canvas.height = image.naturalHeight || image.height || 1;
  canvas.getContext('2d')?.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function meshFromBufferGeometry(geometry) {
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = source.getAttribute('position');
  const uv = source.getAttribute('uv');
  if (!pos) return null;

  const positions = [];
  const faces = [];
  const faceUVs = [];
  for (let i = 0; i < pos.count; i += 3) {
    const face = [];
    const uvs = [];
    for (let j = 0; j < 3; j++) {
      const idx = i + j;
      face.push(positions.length / 3);
      positions.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      uvs.push(uv ? [uv.getX(idx), uv.getY(idx)] : [0, 0]);
    }
    faces.push(face);
    faceUVs.push(uvs);
  }
  source.dispose();
  return new EditableMesh({ name: geometry.name || 'GLTFMesh', positions, faces, faceUVs });
}

/**
 * @param {File[]} files
 * @returns {Promise<import('../store/editorStore.js').SceneObject[]>}
 */
export async function importGLTFFiles(files) {
  const gltfFile = files.find((f) => /\.(gltf|glb)$/i.test(f.name));
  if (!gltfFile) throw new Error('Choose a GLTF or GLB file');
  const urlMap = new Map(await Promise.all(files.map(async (file) => [file.name, await readFileDataUrl(file)])));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => urlMap.get(url.split('/').pop()) ?? url);
  const loader = new GLTFLoader(manager);
  const data = /\.(glb)$/i.test(gltfFile.name)
    ? await gltfFile.arrayBuffer()
    : await gltfFile.text();
  const gltf = await new Promise((resolve, reject) => {
    if (data instanceof ArrayBuffer) loader.parse(data, '', resolve, reject);
    else loader.parse(data, '', resolve, reject);
  });

  gltf.scene.updateMatrixWorld(true);
  const out = [];
  const idByNode = new Map();

  /** @param {import('three').Object3D} node @param {string | null} parentId */
  const importNode = (node, parentId) => {
    const hasMesh = node.isMesh && node.geometry;
    const hasChildren = node.children.length > 0;
    if (!hasMesh && !hasChildren) return;

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    node.matrixWorld.decompose(pos, quat, scale);
    const rotation = new THREE.Euler().setFromQuaternion(quat);
    const objectId = uid();
    idByNode.set(node, objectId);

    if (hasMesh) {
      const mesh = meshFromBufferGeometry(node.geometry);
      if (!mesh) return;
      const mat = Array.isArray(node.material) ? node.material[0] : node.material;
      out.push({
        id: objectId,
        name: safeName(node.name, `GLTF_${out.length + 1}`),
        parentId,
        isGroup: false,
        mesh,
        position: pos.toArray(),
        rotation: [rotation.x, rotation.y, rotation.z],
        scale: scale.toArray(),
        textureDataUrl: imageToDataUrl(mat?.map?.image) ?? null,
        visible: node.visible,
        locked: false,
      });
    } else {
      out.push({
        id: objectId,
        name: safeName(node.name, 'Group'),
        parentId,
        isGroup: true,
        mesh: null,
        position: pos.toArray(),
        rotation: [rotation.x, rotation.y, rotation.z],
        scale: scale.toArray(),
        textureDataUrl: null,
        visible: node.visible,
        locked: false,
      });
    }

    for (const child of node.children) {
      importNode(child, objectId);
    }
  };

  for (const child of gltf.scene.children) {
    importNode(child, null);
  }
  if (out.length === 0) {
    throw new Error('No mesh data found in GLTF file');
  }
  return out;
}
