import * as THREE from 'three';

/**
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number} faceIndex
 * @returns {THREE.BufferGeometry | null}
 */
export function buildFaceGeometry(mesh, faceIndex) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return null;

  const positions = [];
  for (let i = 1; i < face.length - 1; i++) {
    positions.push(
      ...mesh.getPosition(face[0]),
      ...mesh.getPosition(face[i]),
      ...mesh.getPosition(face[i + 1]),
    );
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

/**
 * Closed loop around a face for outline rendering.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number} faceIndex
 */
export function faceOutlinePoints(mesh, faceIndex) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return [];
  const pts = face.map((vi) => new THREE.Vector3(...mesh.getPosition(vi)));
  pts.push(pts[0].clone());
  return pts;
}

/**
 * Line segments along polygon face edges only (no triangle fan diagonals).
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @returns {THREE.BufferGeometry | null}
 */
export function buildMeshOutlineGeometry(mesh) {
  const edges = mesh.getEdges();
  if (edges.length === 0) return null;

  const positions = [];
  for (const [a, b] of edges) {
    const pa = mesh.getPosition(a);
    const pb = mesh.getPosition(b);
    positions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}
