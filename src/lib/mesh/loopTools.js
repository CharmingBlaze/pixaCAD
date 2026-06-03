import { parseEdgeKey } from './edgeKeys.js';

function edgeKey(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function edgeDirection(mesh, from, to) {
  const a = mesh.getPosition(from);
  const b = mesh.getPosition(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.max(1e-8, Math.hypot(dx, dy, dz));
  return [dx / len, dy / len, dz / len];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function buildVertexEdges(mesh) {
  const map = new Map();
  for (const [a, b] of mesh.getEdges()) {
    if (!map.has(a)) map.set(a, []);
    if (!map.has(b)) map.set(b, []);
    map.get(a).push(b);
    map.get(b).push(a);
  }
  return map;
}

function walkStraight(mesh, start, from, vertexEdges, used) {
  const result = [];
  let prev = from;
  let current = start;
  let prevDir = edgeDirection(mesh, prev, current);

  for (let guard = 0; guard < mesh.vertexCount + 4; guard++) {
    let best = null;
    let bestScore = 0.35;
    for (const candidate of vertexEdges.get(current) ?? []) {
      if (candidate === prev) continue;
      const key = edgeKey(current, candidate);
      if (used.has(key)) continue;
      const dir = edgeDirection(mesh, current, candidate);
      const score = dot(prevDir, dir);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (best === null) break;
    const key = edgeKey(current, best);
    used.add(key);
    result.push(key);
    prev = current;
    current = best;
    prevDir = edgeDirection(mesh, prev, current);
  }

  return result;
}

export function collectEdgeLoop(mesh, seedKey) {
  const [a, b] = parseEdgeKey(seedKey);
  if (!Number.isInteger(a) || !Number.isInteger(b) || !mesh) return [];
  const existing = new Set(mesh.getEdges().map(([va, vb]) => edgeKey(va, vb)));
  const seed = edgeKey(a, b);
  if (!existing.has(seed)) return [];

  const vertexEdges = buildVertexEdges(mesh);
  const used = new Set([seed]);
  return [
    ...walkStraight(mesh, a, b, vertexEdges, used).reverse(),
    seed,
    ...walkStraight(mesh, b, a, vertexEdges, used),
  ];
}

function buildEdgeFaces(mesh) {
  const map = new Map();
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    for (let i = 0; i < face.length; i++) {
      const key = edgeKey(face[i], face[(i + 1) % face.length]);
      const uses = map.get(key) ?? [];
      uses.push({ faceIndex: fi, edgeIndex: i });
      map.set(key, uses);
    }
  }
  return map;
}

export function collectEdgeRing(mesh, seedKey) {
  const [a, b] = parseEdgeKey(seedKey);
  if (!Number.isInteger(a) || !Number.isInteger(b) || !mesh) return [];
  const seed = edgeKey(a, b);
  const edgeFaces = buildEdgeFaces(mesh);
  if (!edgeFaces.has(seed)) return [];

  const result = [];
  const seen = new Set();
  const queue = [seed];

  while (queue.length) {
    const key = queue.shift();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);

    for (const use of edgeFaces.get(key) ?? []) {
      const face = mesh.faces[use.faceIndex];
      if (!face || face.length !== 4) continue;
      const oppositeIndex = (use.edgeIndex + 2) % 4;
      const opposite = edgeKey(face[oppositeIndex], face[(oppositeIndex + 1) % 4]);
      if (!seen.has(opposite)) queue.push(opposite);
    }
  }

  return result;
}
