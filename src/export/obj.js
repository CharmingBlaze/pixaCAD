import * as THREE from 'three';
import { BRAND_NAME } from '../lib/brand.js';
import { EditableMesh } from '../lib/mesh/EditableMesh.js';
import { uid } from '../lib/id.js';
import { dataUrlToBlob, readFileDataUrl, readFileText, safeName, saveFiles } from './fileSave.js';

function baseName(path) {
  return String(path ?? '').split(/[\\/]/).pop();
}

/** @param {string} token */
function parseFaceRef(token) {
  const parts = token.split('/');
  const vi = Number(parts[0]);
  if (!Number.isFinite(vi)) return { vi: -1, ti: -1 };
  const tiRaw = parts[1];
  const ti = tiRaw !== undefined && tiRaw !== '' ? Number(tiRaw) : NaN;
  return { vi: vi - 1, ti: Number.isFinite(ti) ? ti - 1 : -1 };
}

function exportableMeshes(objects) {
  return objects.filter((o) => o.mesh && !o.isGroup && o.visible !== false);
}

function worldMatrix(obj) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...obj.position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...obj.rotation)),
    new THREE.Vector3(...obj.scale),
  );
  return matrix;
}

export async function exportSceneToOBJ(objects) {
  const meshes = exportableMeshes(objects);
  if (meshes.length === 0) {
    throw new Error('No visible mesh objects to export');
  }
  const files = [];
  let objText = `# ${BRAND_NAME} OBJ Export\nmtllib model.mtl\n`;
  let mtlText = `# ${BRAND_NAME} MTL Export\n`;
  let vertexOffset = 1;
  let uvOffset = 1;
  const textureNames = new Map();

  for (const obj of meshes) {
    const mesh = obj.mesh;
    if (!mesh) continue;
    const objName = safeName(obj.name, 'Object');
    const materialName = `${objName}_mat`;
    objText += `\no ${objName}\nusemtl ${materialName}\n`;
    mtlText += `\nnewmtl ${materialName}\nKd 1 1 1\n`;

    if (obj.textureDataUrl) {
      const texName = textureNames.get(obj.textureDataUrl) ?? `${objName}_texture.png`;
      textureNames.set(obj.textureDataUrl, texName);
      mtlText += `map_Kd ${texName}\n`;
      if (!files.some((f) => f.name === texName)) {
        files.push({ name: texName, blob: dataUrlToBlob(obj.textureDataUrl) });
      }
    }

    const matrix = worldMatrix(obj);
    const v = new THREE.Vector3();
    for (let i = 0; i < mesh.vertexCount; i++) {
      v.fromArray(mesh.positions, i * 3).applyMatrix4(matrix);
      objText += `v ${v.x.toFixed(6)} ${v.y.toFixed(6)} ${v.z.toFixed(6)}\n`;
    }

    for (const faceUVs of mesh.faceUVs) {
      for (const [u, vv] of faceUVs) objText += `vt ${u.toFixed(6)} ${vv.toFixed(6)}\n`;
    }

    let faceUvCursor = 0;
    for (let fi = 0; fi < mesh.faces.length; fi++) {
      const face = mesh.faces[fi];
      for (let i = 1; i < face.length - 1; i++) {
        const tri = [0, i, i + 1];
        objText += `f ${tri
          .map((idx) => `${face[idx] + vertexOffset}/${faceUvCursor + idx + uvOffset}`)
          .join(' ')}\n`;
      }
      faceUvCursor += mesh.faceUVs[fi]?.length ?? face.length;
    }

    vertexOffset += mesh.vertexCount;
    uvOffset += mesh.faceUVs.reduce((sum, uvs) => sum + uvs.length, 0);
  }

  files.unshift(
    { name: 'model.obj', blob: new Blob([objText], { type: 'text/plain' }) },
    { name: 'model.mtl', blob: new Blob([mtlText], { type: 'text/plain' }) },
  );
  await saveFiles(files, 'pixacad-obj-export');
}

function parseMtl(text) {
  const materialTextures = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [cmd, ...parts] = line.split(/\s+/);
    if (cmd === 'newmtl') current = parts.join(' ');
    if (cmd === 'map_Kd' && current) materialTextures.set(current, parts.join(' '));
  }
  return materialTextures;
}

/**
 * @param {File[]} files
 * @returns {Promise<import('../store/editorStore.js').SceneObject[]>}
 */
export async function importOBJFiles(files) {
  const objFile = files.find((f) => /\.obj$/i.test(f.name));
  if (!objFile) throw new Error('Choose an OBJ file');
  const mtlFile = files.find((f) => /\.mtl$/i.test(f.name));
  const imageFiles = files.filter((f) => /^image\//.test(f.type));
  const imageMap = new Map(await Promise.all(imageFiles.map(async (f) => [f.name, await readFileDataUrl(f)])));
  const materialTextures = mtlFile ? parseMtl(await readFileText(mtlFile)) : new Map();
  const objText = await readFileText(objFile);

  const positions = [];
  const texcoords = [];
  const groups = [];
  let current = { name: objFile.name.replace(/\.obj$/i, ''), faces: [], faceUVs: [], material: null };
  groups.push(current);

  for (const raw of objText.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [cmd, ...parts] = line.split(/\s+/);
    if (cmd === 'v') positions.push(parts.slice(0, 3).map(Number));
    if (cmd === 'vt') texcoords.push(parts.slice(0, 2).map(Number));
    if (cmd === 'o' || cmd === 'g') {
      if (current.faces.length > 0) {
        current = { name: parts.join('_') || 'Object', faces: [], faceUVs: [], material: current.material };
        groups.push(current);
      } else {
        current.name = parts.join('_') || current.name;
      }
    }
    if (cmd === 'usemtl') current.material = parts.join(' ');
    if (cmd === 'f') {
      const refs = parts.map(parseFaceRef).filter((r) => r.vi >= 0);
      if (refs.length >= 3) {
        current.faces.push(refs.map((r) => r.vi));
        current.faceUVs.push(
          refs.map((r) => (r.ti >= 0 && texcoords[r.ti] ? [texcoords[r.ti][0], texcoords[r.ti][1]] : [0, 0])),
        );
      }
    }
  }

  const imported = groups
    .filter((g) => g.faces.length > 0)
    .map((g, index) => {
      const used = [...new Set(g.faces.flat())].sort((a, b) => a - b);
      const remap = new Map(used.map((vi, i) => [vi, i]));
      const localPositions = used.flatMap((vi) => positions[vi] ?? [0, 0, 0]);
      const textureName = materialTextures.get(g.material);
      return {
        id: uid(),
        name: safeName(g.name, `OBJ_${index + 1}`),
        parentId: null,
        isGroup: false,
        mesh: new EditableMesh({
          name: g.name,
          positions: localPositions,
          faces: g.faces.map((face) => face.map((vi) => remap.get(vi))),
          faceUVs: g.faceUVs,
          faceColors: g.faces.map(() => '#c8b070'),
        }),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureDataUrl: textureName ? imageMap.get(textureName) ?? imageMap.get(baseName(textureName)) ?? null : null,
        visible: true,
        locked: false,
      };
    });
  if (imported.length === 0) {
    throw new Error('No faces found in OBJ file');
  }
  return imported;
}
