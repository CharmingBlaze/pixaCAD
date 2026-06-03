/**
 * Edge keys are canonical "a_b" with a < b (vertex indices).
 * @param {string} key
 * @returns {[number, number]}
 */
export function parseEdgeKey(key) {
  const [a, b] = key.split('_').map(Number);
  return [a, b];
}

/**
 * Unique vertex indices touched by the given edge keys.
 * @param {string[]} edgeKeys
 * @returns {number[]}
 */
export function verticesFromEdgeKeys(edgeKeys) {
  const verts = new Set();
  for (const key of edgeKeys) {
    const [a, b] = parseEdgeKey(key);
    verts.add(a);
    verts.add(b);
  }
  return [...verts];
}

/**
 * Unique vertex indices touched by the given face indices.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} faceIndices
 * @returns {number[]}
 */
export function verticesFromFaceIndices(mesh, faceIndices) {
  const verts = new Set();
  for (const fi of faceIndices) {
    const face = mesh.faces[fi];
    if (!face) continue;
    for (const vi of face) verts.add(vi);
  }
  return [...verts];
}
