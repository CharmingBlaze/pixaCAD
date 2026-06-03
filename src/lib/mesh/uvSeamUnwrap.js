/** @param {number} a @param {number} b */
function edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/**
 * Build face adjacency across non-seam edges.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {Set<string>} seamEdges
 */
function faceIslands(mesh, seamEdges) {
  const faceNeighbors = mesh.faces.map(() => []);
  const edgeToFaces = new Map();
  mesh.faces.forEach((face, fi) => {
    for (let i = 0; i < face.length; i++) {
      const key = edgeKey(face[i], face[(i + 1) % face.length]);
      const list = edgeToFaces.get(key) ?? [];
      list.push(fi);
      edgeToFaces.set(key, list);
    }
  });
  for (const [key, faces] of edgeToFaces) {
    if (seamEdges.has(key) || faces.length !== 2) continue;
    faceNeighbors[faces[0]].push(faces[1]);
    faceNeighbors[faces[1]].push(faces[0]);
  }

  const islands = [];
  const visited = new Set();
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    if (visited.has(fi)) continue;
    const island = [];
    const stack = [fi];
    visited.add(fi);
    while (stack.length) {
      const cur = stack.pop();
      island.push(cur);
      for (const nb of faceNeighbors[cur]) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        stack.push(nb);
      }
    }
    islands.push(island);
  }
  return islands;
}

/**
 * Planar UV projection for a face island using averaged normal.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} faceIndices
 */
function projectIslandUVs(mesh, faceIndices) {
  const verts = new Set();
  for (const fi of faceIndices) {
    for (const vi of mesh.faces[fi] ?? []) verts.add(vi);
  }
  const normal = mesh.getFaceNormal(faceIndices[0]);
  const nx = normal.x;
  const ny = normal.y;
  const nz = normal.z;
  const anchor = mesh.getPosition([...verts][0]);
  const up = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const tangent = normalize3(cross3(up, [nx, ny, nz]));
  const bitangent = cross3([nx, ny, nz], tangent);

  const uvByVert = new Map();
  for (const vi of verts) {
    const p = mesh.getPosition(vi);
    const rel = [p[0] - anchor[0], p[1] - anchor[1], p[2] - anchor[2]];
    uvByVert.set(vi, [dot3(rel, tangent), dot3(rel, bitangent)]);
  }

  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;
  for (const uv of uvByVert.values()) {
    minU = Math.min(minU, uv[0]);
    minV = Math.min(minV, uv[1]);
    maxU = Math.max(maxU, uv[0]);
    maxV = Math.max(maxV, uv[1]);
  }
  const w = Math.max(maxU - minU, 1e-6);
  const h = Math.max(maxV - minV, 1e-6);
  const out = {};
  for (const fi of faceIndices) {
    out[fi] = mesh.faces[fi].map((vi) => {
      const uv = uvByVert.get(vi);
      return [clamp01((uv[0] - minU) / w), clamp01((uv[1] - minV) / h)];
    });
  }
  return out;
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/** @param {number[]} a @param {number[]} b */
function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** @param {number[]} v */
function normalize3(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** @param {number[]} a @param {number[]} b */
function dot3(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Unwrap selected faces using seam edges to split islands, then pack into 0–1.
 * @param {import('./EditableMesh.js').EditableMesh} mesh
 * @param {number[]} faceIndices
 * @param {string[]} seamEdgeKeys
 * @param {number} padding
 */
export function seamAwareUnwrap(mesh, faceIndices, seamEdgeKeys, padding = 0.02) {
  const selected = new Set(faceIndices.filter((fi) => fi >= 0 && fi < mesh.faceCount));
  const seamEdges = new Set(seamEdgeKeys);
  const allIslands = faceIslands(mesh, seamEdges).map((island) => island.filter((fi) => selected.has(fi))).filter((x) => x.length > 0);
  const islandUvs = allIslands.map((island) => projectIslandUVs(mesh, island));

  const cols = Math.max(1, Math.ceil(Math.sqrt(islandUvs.length)));
  const rows = Math.max(1, Math.ceil(islandUvs.length / cols));
  const cellW = (1 - padding * 2) / cols;
  const cellH = (1 - padding * 2) / rows;
  const merged = {};
  islandUvs.forEach((islandMap, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const offsetU = padding + col * cellW;
    const offsetV = padding + row * cellH;
    for (const [fiStr, uvs] of Object.entries(islandMap)) {
      const fi = Number(fiStr);
      merged[fi] = uvs.map(([u, v]) => [offsetU + u * cellW, offsetV + v * cellH]);
    }
  });
  return merged;
}
