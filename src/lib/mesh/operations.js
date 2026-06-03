import * as THREE from 'three';
import { DEFAULT_PAINT_COLOR } from '../defaultColors.js';
import { EditableMesh } from './EditableMesh.js';

function normalizedFace(indices) {
  const face = [];
  for (const vi of indices) {
    if (!Number.isInteger(vi) || vi < 0) continue;
    face.push(vi);
  }
  if (face.length > 1 && face[0] === face[face.length - 1]) face.pop();
  return new Set(face).size === face.length ? face : [];
}

function keyForEdge(a, b) {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function addToVec3(out, vec) {
  out[0] += vec.x;
  out[1] += vec.y;
  out[2] += vec.z;
}

function normalizeVec3(vec, fallback = [0, 1, 0]) {
  const len = Math.hypot(vec[0], vec[1], vec[2]);
  if (len < 1e-8) return [...fallback];
  return [vec[0] / len, vec[1] / len, vec[2] / len];
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function normalizeFaceRing(indices) {
  const out = [];
  for (const vi of indices) {
    if (!Number.isInteger(vi)) continue;
    if (out[out.length - 1] !== vi) out.push(vi);
  }
  if (out.length > 1 && out[0] === out[out.length - 1]) out.pop();
  return new Set(out).size === out.length ? out : [];
}

function ringPath(ring, start, end) {
  const out = [];
  let i = start;
  while (true) {
    out.push(ring[i]);
    if (i === end) break;
    i = (i + 1) % ring.length;
    if (out.length > ring.length + 1) return [];
  }
  return normalizeFaceRing(out);
}

/**
 * @param {EditableMesh} mesh
 * @param {number[]} faceIndices
 * @param {number} distance
 */
export function extrudeFaces(mesh, faceIndices, distance = 0.5) {
  const next = mesh.clone();
  const selected = [...new Set(faceIndices)].filter((fi) => next.faces[fi]);
  if (selected.length === 0) return next;

  const normalSum = [0, 0, 0];
  for (const fi of selected) addToVec3(normalSum, mesh.getFaceNormal(fi));
  const normal = normalizeVec3(normalSum);

  const selectedSet = new Set(selected);
  const selectedVerts = new Set();
  const boundaryEdges = [];
  const edgeUse = new Map();

  for (const fi of selected) {
    const face = next.faces[fi];
    for (const vi of face) selectedVerts.add(vi);
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = keyForEdge(a, b);
      const entry = edgeUse.get(key) ?? { count: 0, oriented: [a, b] };
      entry.count += 1;
      entry.oriented = [a, b];
      edgeUse.set(key, entry);
    }
  }

  for (const entry of edgeUse.values()) {
    if (entry.count === 1) boundaryEdges.push(entry.oriented);
  }

  // Blender-style: original face(s) stay at the base; duplicated verts form the top cap.

  const remap = new Map();
  for (const vi of selectedVerts) {
    const p = mesh.getPosition(vi);
    const newIdx = next.vertexCount;
    next.positions.push(
      p[0] + normal[0] * distance,
      p[1] + normal[1] * distance,
      p[2] + normal[2] * distance,
    );
    remap.set(vi, newIdx);
  }

  for (const fi of selected) {
    const cap = next.faces[fi].map((vi) => remap.get(vi));
    next.faces.push(cap);
    next.faceColors.push(next.faceColors[fi] ?? DEFAULT_PAINT_COLOR);
  }

  for (const [a, b] of boundaryEdges) {
    const newA = remap.get(a);
    const newB = remap.get(b);
    if (newA === undefined || newB === undefined) continue;
    let color = DEFAULT_PAINT_COLOR;
    for (const fi of selectedSet) {
      const face = mesh.faces[fi];
      const hasEdge = face.some((vi, i) => {
        const vj = face[(i + 1) % face.length];
        return (vi === a && vj === b) || (vi === b && vj === a);
      });
      if (hasEdge) {
        color = next.faceColors[fi] ?? color;
        break;
      }
    }
    next.faces.push([a, b, newB, newA]);
    next.faceColors.push(color);
  }

  next.normalizeFaceWinding();
  return next;
}

/**
 * Extrude faces independently along each face normal. Kept available for tools that
 * need per-face spikes, while the editor uses region extrusion above.
 * @param {EditableMesh} mesh
 * @param {number[]} faceIndices
 * @param {number} distance
 */
export function extrudeFacesIndividually(mesh, faceIndices, distance = 0.5) {
  const next = mesh.clone();

  for (const fi of faceIndices) {
    const face = next.faces[fi];
    if (!face) continue;
    const normal = mesh.getFaceNormal(fi);
    const ringVerts = [...face];
    const capVerts = face.map((vi) => {
      const p = mesh.getPosition(vi);
      const newIdx = next.vertexCount;
      next.positions.push(
        p[0] + normal.x * distance,
        p[1] + normal.y * distance,
        p[2] + normal.z * distance,
      );
      return newIdx;
    });
    const color = next.faceColors[fi] ?? DEFAULT_PAINT_COLOR;
    for (let i = 0; i < face.length; i++) {
      const a = ringVerts[i];
      const b = ringVerts[(i + 1) % face.length];
      const c = capVerts[(i + 1) % face.length];
      const d = capVerts[i];
      next.faces.push([a, b, c, d]);
      next.faceColors.push(color);
    }
    next.faces[fi] = capVerts;
  }
  next.normalizeFaceWinding();
  return next;
}

/**
 * Extrude selected edges by duplicating their vertices in place, creating bridge quads,
 * and returning the duplicated edge keys for immediate move/gizmo editing.
 * @param {EditableMesh} mesh
 * @param {string[]} edgeKeys
 * @param {string} color
 * @returns {{ mesh: EditableMesh, edgeKeys: string[] }}
 */
export function extrudeEdges(mesh, edgeKeys, color = DEFAULT_PAINT_COLOR) {
  const existing = new Set(mesh.getEdges().map(([a, b]) => keyForEdge(a, b)));
  const selected = [...new Set(edgeKeys)].filter((key) => existing.has(key));
  const next = mesh.clone();
  if (selected.length === 0) return { mesh: next, edgeKeys: [] };

  const remap = new Map();
  const getDuplicate = (vi) => {
    if (remap.has(vi)) return remap.get(vi);
    const p = mesh.getPosition(vi);
    const idx = next.vertexCount;
    next.positions.push(p[0], p[1], p[2]);
    remap.set(vi, idx);
    return idx;
  };

  const newEdgeKeys = [];
  for (const key of selected) {
    const [a, b] = key.split('_').map(Number);
    const newA = getDuplicate(a);
    const newB = getDuplicate(b);
    next.faces.push([a, b, newB, newA]);
    next.faceColors.push(color);
    newEdgeKeys.push(keyForEdge(newA, newB));
  }

  next.normalizeFaceWinding();
  return { mesh: next, edgeKeys: newEdgeKeys };
}

/**
 * Cut one polygon face by drawing a line across it. The two supplied points may
 * be inside the face; the operation extends that line to the polygon boundary.
 * @param {EditableMesh} mesh
 * @param {number} faceIndex
 * @param {[number, number, number]} localA
 * @param {[number, number, number]} localB
 * @returns {{ mesh: EditableMesh, cut: boolean, faceIndices: number[] }}
 */
export function knifeCutFace(mesh, faceIndex, localA, localB) {
  const face = mesh.faces[faceIndex];
  if (!face || face.length < 3) return { mesh: mesh.clone(), cut: false, faceIndices: [] };

  const next = mesh.clone();
  const normal = mesh.getFaceNormal(faceIndex);
  if (normal.lengthSq() < 1e-10) return { mesh: next, cut: false, faceIndices: [] };

  const a3 = new THREE.Vector3(...localA);
  const b3 = new THREE.Vector3(...localB);
  const cutDir3 = b3.clone().sub(a3).projectOnPlane(normal);
  if (cutDir3.lengthSq() < 1e-10) return { mesh: next, cut: false, faceIndices: [] };

  const xAxis = cutDir3.normalize();
  const yAxis = new THREE.Vector3().crossVectors(normal, xAxis).normalize();
  const origin = a3;
  const to2 = (p) => {
    const v = new THREE.Vector3(...p).sub(origin);
    return [v.dot(xAxis), v.dot(yAxis)];
  };

  const a2 = [0, 0];
  const b2 = to2(localB);
  const d = [b2[0] - a2[0], b2[1] - a2[1]];
  if (Math.hypot(d[0], d[1]) < 1e-8) return { mesh: next, cut: false, faceIndices: [] };

  const points3 = face.map((vi) => mesh.getPosition(vi));
  const points2 = points3.map(to2);
  const hits = [];
  const eps = 1e-6;

  for (let i = 0; i < face.length; i++) {
    const j = (i + 1) % face.length;
    const p = points2[i];
    const q = points2[j];
    const edge = [q[0] - p[0], q[1] - p[1]];
    const denom = cross2(edge, d);
    if (Math.abs(denom) < eps) continue;

    const ap = [a2[0] - p[0], a2[1] - p[1]];
    const t = cross2(ap, d) / denom;
    if (t < -eps || t > 1 + eps) continue;

    const clampedT = Math.max(0, Math.min(1, t));
    const hit2 = [p[0] + edge[0] * clampedT, p[1] + edge[1] * clampedT];
    const u = (Math.abs(d[0]) >= Math.abs(d[1]) ? hit2[0] / d[0] : hit2[1] / d[1]);
    const pa = points3[i];
    const pb = points3[j];
    const hit3 = [
      pa[0] + (pb[0] - pa[0]) * clampedT,
      pa[1] + (pb[1] - pa[1]) * clampedT,
      pa[2] + (pb[2] - pa[2]) * clampedT,
    ];

    if (
      hits.some((h) => Math.hypot(h.point[0] - hit3[0], h.point[1] - hit3[1], h.point[2] - hit3[2]) < 1e-5)
    ) {
      continue;
    }
    hits.push({ edgeIndex: i, t: clampedT, u, point: hit3 });
  }

  if (hits.length < 2) return { mesh: next, cut: false, faceIndices: [] };
  hits.sort((h1, h2) => h1.u - h2.u);
  const cutHits = [hits[0], hits[hits.length - 1]];
  if (cutHits[0].edgeIndex === cutHits[1].edgeIndex) return { mesh: next, cut: false, faceIndices: [] };

  const vertexForHit = (hit) => {
    const a = face[hit.edgeIndex];
    const b = face[(hit.edgeIndex + 1) % face.length];
    if (hit.t <= 1e-5) return a;
    if (hit.t >= 1 - 1e-5) return b;
    const idx = next.vertexCount;
    next.positions.push(...hit.point);
    return idx;
  };

  const hitVerts = cutHits.map(vertexForHit);
  if (hitVerts[0] === hitVerts[1]) return { mesh: next, cut: false, faceIndices: [] };

  const hitsByEdge = new Map();
  cutHits.forEach((hit, i) => {
    if (hit.t <= 1e-5 || hit.t >= 1 - 1e-5) return;
    const list = hitsByEdge.get(hit.edgeIndex) ?? [];
    list.push({ ...hit, vertex: hitVerts[i] });
    hitsByEdge.set(hit.edgeIndex, list.sort((a, b) => a.t - b.t));
  });

  const ring = [];
  for (let i = 0; i < face.length; i++) {
    ring.push(face[i]);
    for (const hit of hitsByEdge.get(i) ?? []) ring.push(hit.vertex);
  }

  const i0 = ring.indexOf(hitVerts[0]);
  const i1 = ring.indexOf(hitVerts[1]);
  if (i0 < 0 || i1 < 0 || i0 === i1) return { mesh: next, cut: false, faceIndices: [] };

  const faceA = ringPath(ring, i0, i1);
  const faceB = ringPath(ring, i1, i0);
  if (faceA.length < 3 || faceB.length < 3) return { mesh: next, cut: false, faceIndices: [] };

  const color = next.faceColors[faceIndex] ?? DEFAULT_PAINT_COLOR;
  next.faces[faceIndex] = faceA;
  next.faceColors[faceIndex] = color;
  next.faces.push(faceB);
  next.faceColors.push(color);
  next.normalizeFaceWinding();

  return { mesh: next, cut: true, faceIndices: [faceIndex, next.faces.length - 1] };
}

/**
 * Bevel selected edges (chamfer). Adjacent faces are trimmed and bevel quads are inserted.
 * @param {EditableMesh} mesh
 * @param {string[]} edgeKeys
 * @param {number} amount — inset fraction along adjacent face edges (0–1)
 * @param {string} color
 * @param {number} segments — chamfer subdivisions (Blender scroll segments)
 * @returns {{ mesh: EditableMesh, faceIndices: number[], edgeKeys: string[] }}
 */
export function bevelEdges(mesh, edgeKeys, amount = 0.18, color = DEFAULT_PAINT_COLOR, segments = 1) {
  const selected = new Set(edgeKeys.filter((key) => /^\d+_\d+$/.test(key)));
  if (selected.size === 0) return { mesh: mesh.clone(), faceIndices: [], edgeKeys: [] };

  const next = mesh.clone();
  const faceEdgeReplacements = new Map();
  const bevelFaces = [];
  const newFaceIndices = [];
  const resultEdgeKeys = [];
  const clampAmount = Math.max(0.01, Math.min(amount, 0.45));
  const segCount = Math.max(1, Math.min(8, Math.round(segments)));

  const addPoint = (point) => {
    const idx = next.vertexCount;
    next.positions.push(point[0], point[1], point[2]);
    return idx;
  };

  const lerp = (from, to, t) => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];

  const edgeUses = new Map();
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = keyForEdge(a, b);
      if (!selected.has(key)) continue;
      const list = edgeUses.get(key) ?? [];
      list.push({ fi, edgeIndex: i, a, b });
      edgeUses.set(key, list);
    }
  }

  for (const [key, uses] of edgeUses) {
    if (uses.length === 0) continue;
    /** @type {{ a: number, b: number }[][]} */
    const sideStrips = [];

    for (const use of uses.slice(0, 2)) {
      const face = mesh.faces[use.fi];
      if (!face || face.length < 3) continue;
      const prev = face[(use.edgeIndex - 1 + face.length) % face.length];
      const nextVi = face[(use.edgeIndex + 2) % face.length];
      const pa = mesh.getPosition(use.a);
      const pb = mesh.getPosition(use.b);
      const pPrev = mesh.getPosition(prev);
      const pNext = mesh.getPosition(nextVi);

      const strip = [];
      for (let s = 1; s <= segCount; s++) {
        const t = (clampAmount * s) / segCount;
        strip.push({
          a: addPoint(lerp(pa, pPrev, t)),
          b: addPoint(lerp(pb, pNext, t)),
        });
      }

      const repl = faceEdgeReplacements.get(use.fi) ?? new Map();
      repl.set(`${use.a}_${use.b}`, strip.flatMap((level) => [level.a, level.b]));
      faceEdgeReplacements.set(use.fi, repl);
      sideStrips.push(strip);
    }

    const [origA, origB] = key.split('_').map(Number);
    if (sideStrips.length === 1) {
      const strip = sideStrips[0];
      let prevA = origA;
      let prevB = origB;
      for (const level of strip) {
        bevelFaces.push([prevA, prevB, level.b, level.a]);
        prevA = level.a;
        prevB = level.b;
      }
      const last = strip[strip.length - 1];
      resultEdgeKeys.push(keyForEdge(last.a, last.b));
    } else if (sideStrips.length >= 2) {
      const left = sideStrips[0];
      const right = sideStrips[1];
      const levels = Math.max(left.length, right.length);
      for (let i = 0; i < levels; i++) {
        const l = left[Math.min(i, left.length - 1)];
        const r = right[Math.min(i, right.length - 1)];
        bevelFaces.push([l.a, l.b, r.b, r.a]);
      }
      const lastL = left[left.length - 1];
      const lastR = right[right.length - 1];
      resultEdgeKeys.push(keyForEdge(lastL.a, lastL.b), keyForEdge(lastR.a, lastR.b));
    }
  }

  if (bevelFaces.length === 0) return { mesh: next, faceIndices: [], edgeKeys: [] };

  const newFaces = [];
  const newColors = [];
  for (let fi = 0; fi < next.faces.length; fi++) {
    const face = next.faces[fi];
    const repl = faceEdgeReplacements.get(fi);
    if (!repl) {
      newFaces.push(face);
      newColors.push(next.faceColors[fi]);
      continue;
    }

    const ring = [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const replacement = repl.get(`${a}_${b}`);
      if (replacement) {
        ring.push(...replacement);
      } else {
        ring.push(a);
      }
    }
    const normalized = normalizeFaceRing(ring);
    if (normalized.length >= 3) {
      newFaces.push(normalized);
      newColors.push(next.faceColors[fi]);
    }
  }

  for (const face of bevelFaces) {
    const normalized = normalizeFaceRing(face);
    if (normalized.length < 3) continue;
    newFaceIndices.push(newFaces.length);
    newFaces.push(normalized);
    newColors.push(color);
  }

  next.faces = newFaces;
  next.faceColors = newColors;
  next.normalizeFaceWinding();
  return { mesh: next, faceIndices: newFaceIndices, edgeKeys: [...new Set(resultEdgeKeys)] };
}

/**
 * @param {EditableMesh} mesh
 * @param {number} threshold
 */
export function weldVertices(mesh, threshold = 0.08) {
  const next = mesh.clone();
  const remap = new Array(next.vertexCount).fill(-1);
  const groups = [];

  for (let i = 0; i < next.vertexCount; i++) {
    if (remap[i] !== -1) continue;
    const pi = next.getPosition(i);
    const group = [i];
    remap[i] = i;
    for (let j = i + 1; j < next.vertexCount; j++) {
      if (remap[j] !== -1) continue;
      const pj = next.getPosition(j);
      const d = Math.hypot(pi[0] - pj[0], pi[1] - pj[1], pi[2] - pj[2]);
      if (d <= threshold) {
        remap[j] = i;
        group.push(j);
      }
    }
    groups.push(group);
  }

  const newPositions = [];
  const indexMap = new Array(next.vertexCount);
  let idx = 0;
  for (const group of groups) {
    const avg = [0, 0, 0];
    for (const vi of group) {
      const p = next.getPosition(vi);
      avg[0] += p[0];
      avg[1] += p[1];
      avg[2] += p[2];
      indexMap[vi] = idx;
    }
    avg[0] /= group.length;
    avg[1] /= group.length;
    avg[2] /= group.length;
    newPositions.push(...avg);
    idx++;
  }

  next.positions = newPositions;
  next.faces = next.faces.map((face) => face.map((vi) => indexMap[vi]));
  next.normalizeFaceWinding();
  return next;
}

/**
 * Collapse selected vertices to their shared center and remove degenerate faces.
 * @param {EditableMesh} mesh
 * @param {number[]} vertexIndices
 */
export function mergeVerticesToCenter(mesh, vertexIndices) {
  const selected = [...new Set(vertexIndices)].filter((vi) => vi >= 0 && vi < mesh.vertexCount);
  if (selected.length < 2) return mesh.clone();

  const center = [0, 0, 0];
  for (const vi of selected) {
    const p = mesh.getPosition(vi);
    center[0] += p[0];
    center[1] += p[1];
    center[2] += p[2];
  }
  center[0] /= selected.length;
  center[1] /= selected.length;
  center[2] /= selected.length;

  const selectedSet = new Set(selected);
  const keepPrimary = selected[0];
  const remap = new Array(mesh.vertexCount).fill(-1);
  const positions = [];

  for (let i = 0; i < mesh.vertexCount; i++) {
    if (selectedSet.has(i) && i !== keepPrimary) {
      remap[i] = 0;
      continue;
    }
    remap[i] = positions.length / 3;
    if (i === keepPrimary) positions.push(center[0], center[1], center[2]);
    else positions.push(...mesh.getPosition(i));
  }

  const primaryIndex = remap[keepPrimary];
  for (const vi of selected) remap[vi] = primaryIndex;

  const faces = [];
  const colors = [];
  const faceUVs = [];
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = [];
    const uvs = [];
    for (let i = 0; i < mesh.faces[fi].length; i++) {
      const vi = remap[mesh.faces[fi][i]];
      if (face[face.length - 1] === vi) continue;
      face.push(vi);
      uvs.push(mesh.faceUVs[fi]?.[i] ?? [0, 0]);
    }
    if (face.length > 1 && face[0] === face[face.length - 1]) {
      face.pop();
      uvs.pop();
    }
    if (face.length >= 3 && new Set(face).size === face.length) {
      faces.push(face);
      colors.push(mesh.faceColors[fi] ?? DEFAULT_PAINT_COLOR);
      faceUVs.push(uvs);
    }
  }

  return new EditableMesh({
    name: mesh.name,
    positions,
    faces,
    faceColors: colors,
    faceUVs,
  });
}

/**
 * @param {EditableMesh} mesh
 * @param {number[] | null} faceIndices
 */
export function subdivideFaces(mesh, faceIndices = null) {
  const next = mesh.clone();
  const edgeMid = new Map();
  const selected = faceIndices?.length ? new Set(faceIndices) : null;

  const getMid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeMid.has(key)) return edgeMid.get(key);
    const pa = next.getPosition(a);
    const pb = next.getPosition(b);
    const idx = next.vertexCount;
    next.positions.push((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2);
    edgeMid.set(key, idx);
    return idx;
  };

  const newFaces = [];
  const newColors = [];
  const newFaceUVs = [];

  for (let fi = 0; fi < next.faces.length; fi++) {
    const face = next.faces[fi];
    const color = next.faceColors[fi];
    const uvs = next.faceUVs[fi] ?? face.map(() => [0, 0]);
    if (selected && !selected.has(fi)) {
      newFaces.push(face);
      newColors.push(color);
      newFaceUVs.push(uvs.map(([u, v]) => [u, v]));
      continue;
    }
    if (face.length === 3) {
      const m01 = getMid(face[0], face[1]);
      const m12 = getMid(face[1], face[2]);
      const m20 = getMid(face[2], face[0]);
      const uv01 = averageUv(uvs[0], uvs[1]);
      const uv12 = averageUv(uvs[1], uvs[2]);
      const uv20 = averageUv(uvs[2], uvs[0]);
      newFaces.push([face[0], m01, m20], [m01, face[1], m12], [m20, m12, face[2]], [m01, m12, m20]);
      newColors.push(color, color, color, color);
      newFaceUVs.push([uvs[0], uv01, uv20], [uv01, uvs[1], uv12], [uv20, uv12, uvs[2]], [uv01, uv12, uv20]);
    } else if (face.length === 4) {
      const m01 = getMid(face[0], face[1]);
      const m12 = getMid(face[1], face[2]);
      const m23 = getMid(face[2], face[3]);
      const m30 = getMid(face[3], face[0]);
      const center = next.vertexCount;
      const c = next.getFaceCenter(fi);
      next.positions.push(c[0], c[1], c[2]);
      const uv01 = averageUv(uvs[0], uvs[1]);
      const uv12 = averageUv(uvs[1], uvs[2]);
      const uv23 = averageUv(uvs[2], uvs[3]);
      const uv30 = averageUv(uvs[3], uvs[0]);
      const uvCenter = averageUv(averageUv(uvs[0], uvs[2]), averageUv(uvs[1], uvs[3]));
      newFaces.push(
        [face[0], m01, center, m30],
        [m01, face[1], m12, center],
        [center, m12, face[2], m23],
        [m30, center, m23, face[3]],
      );
      newColors.push(color, color, color, color);
      newFaceUVs.push(
        [uvs[0], uv01, uvCenter, uv30],
        [uv01, uvs[1], uv12, uvCenter],
        [uvCenter, uv12, uvs[2], uv23],
        [uv30, uvCenter, uv23, uvs[3]],
      );
    } else {
      const center = next.vertexCount;
      const c = next.getFaceCenter(fi);
      next.positions.push(c[0], c[1], c[2]);
      const uvCenter = uvs.reduce((sum, uv) => [sum[0] + uv[0], sum[1] + uv[1]], [0, 0]).map((value) => value / Math.max(1, uvs.length));
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const mid = getMid(a, b);
        const prevMid = getMid(face[(i - 1 + face.length) % face.length], a);
        const uvMid = averageUv(uvs[i], uvs[(i + 1) % face.length]);
        const uvPrevMid = averageUv(uvs[(i - 1 + face.length) % face.length], uvs[i]);
        newFaces.push([a, mid, center, prevMid]);
        newColors.push(color);
        newFaceUVs.push([uvs[i], uvMid, uvCenter, uvPrevMid]);
      }
    }
  }

  next.faces = newFaces;
  next.faceColors = newColors;
  next.faceUVs = newFaceUVs.map((uvsForFace) => uvsForFace.map(([u, v]) => [u, v]));
  next.normalizeFaceWinding();
  return next;
}

/**
 * @param {EditableMesh} mesh
 * @param {'x' | 'y' | 'z'} axis
 */
export function mirrorMesh(mesh, axis = 'x') {
  const next = mesh.clone();
  const offset = next.vertexCount;
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

  for (let i = 0; i < mesh.vertexCount; i++) {
    const p = mesh.getPosition(i);
    const mirrored = [...p];
    mirrored[axisIdx] *= -1;
    next.positions.push(...mirrored);
  }

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const mirrored = face.map((vi) => vi + offset).reverse();
    next.faces.push(mirrored);
    next.faceColors.push(mesh.faceColors[fi]);
    next.faceUVs.push(mesh.faceUVs[fi]?.map(([u, v]) => [1 - u, v]) ?? []);
  }
  return next;
}

/**
 * @param {EditableMesh} mesh
 * @param {'x' | 'y' | 'z'} axis
 * @param {number[] | null} vertexIndices
 */
export function flipMeshAcrossAxis(mesh, axis = 'x', vertexIndices = null) {
  const next = mesh.clone();
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const selected = vertexIndices?.length ? new Set(vertexIndices) : null;

  for (let i = 0; i < next.vertexCount; i++) {
    if (selected && !selected.has(i)) continue;
    const p = next.getPosition(i);
    p[axisIdx] *= -1;
    next.setPosition(i, p[0], p[1], p[2]);
  }

  const touchedFaces = selected
    ? next.faces
        .map((face, fi) => (face.some((vi) => selected.has(vi)) ? fi : -1))
        .filter((fi) => fi >= 0)
    : next.faces.map((_, fi) => fi);
  for (const fi of touchedFaces) {
    next.faces[fi] = [...next.faces[fi]].reverse();
    if (next.faceUVs[fi]) next.faceUVs[fi] = [...next.faceUVs[fi]].reverse();
  }

  next.normalizeFaceWinding();
  return next;
}

/** @param {EditableMesh} mesh @param {number[]} faceIndices */
export function flipFaceNormals(mesh, faceIndices) {
  const next = mesh.clone();
  for (const fi of faceIndices) {
    if (!next.faces[fi]) continue;
    next.faces[fi] = [...next.faces[fi]].reverse();
    if (next.faceUVs[fi]) next.faceUVs[fi] = [...next.faceUVs[fi]].reverse();
  }
  return next;
}

/**
 * @param {EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {[number, number, number]} delta
 */
export function translateVertices(mesh, vertexIndices, delta) {
  const next = mesh.clone();
  for (const vi of vertexIndices) {
    const p = next.getPosition(vi);
    next.setPosition(vi, p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]);
  }
  return next;
}

/**
 * @param {EditableMesh} mesh
 * @param {number[]} faceIndices
 * @param {string} color
 */
export function paintFaces(mesh, faceIndices, color) {
  const next = mesh.clone();
  for (const fi of faceIndices) {
    if (next.faceColors[fi] !== undefined) next.faceColors[fi] = color;
  }
  return next;
}

/** @param {EditableMesh} mesh @param {number[]} indices */
export function removeFaces(mesh, faceIndices) {
  const remove = new Set(faceIndices);
  const next = mesh.clone();
  next.faces = next.faces.filter((_, i) => !remove.has(i));
  next.faceColors = next.faceColors.filter((_, i) => !remove.has(i));
  return next;
}

/**
 * Remove vertices and drop faces that reference them.
 * @param {EditableMesh} mesh
 * @param {number[]} vertexIndices
 */
export function removeVertices(mesh, vertexIndices) {
  const remove = new Set(vertexIndices);
  const next = mesh.clone();
  const remap = new Array(next.vertexCount).fill(-1);
  const newPositions = [];

  for (let i = 0; i < next.vertexCount; i++) {
    if (remove.has(i)) continue;
    remap[i] = newPositions.length / 3;
    newPositions.push(...next.getPosition(i));
  }

  next.positions = newPositions;
  const newFaces = [];
  const newColors = [];
  for (let fi = 0; fi < next.faces.length; fi++) {
    const face = next.faces[fi]
      .map((vi) => remap[vi])
      .filter((vi) => vi >= 0);
    const unique = new Set(face);
    if (face.length >= 3 && unique.size === face.length) {
      newFaces.push(face);
      newColors.push(next.faceColors[fi] ?? DEFAULT_PAINT_COLOR);
    }
  }
  next.faces = newFaces;
  next.faceColors = newColors;
  next.normalizeFaceWinding();
  return next;
}

/**
 * Split selected edges at midpoints.
 * @param {EditableMesh} mesh
 * @param {string[]} edgeKeys — "a_b" with a < b
 */
/**
 * Remove all faces that contain any of the given edges.
 * @param {EditableMesh} mesh
 * @param {string[]} edgeKeys
 */
export function removeFacesWithEdges(mesh, edgeKeys) {
  const keys = new Set(edgeKeys);
  const faceIndices = [];
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (keys.has(key)) {
        faceIndices.push(fi);
        break;
      }
    }
  }
  return removeFaces(mesh, faceIndices);
}

export function splitEdges(mesh, edgeKeys) {
  const next = mesh.clone();
  const edgeMid = new Map();

  const getMid = (a, b) => {
    const key = a < b ? `${a}_${b}` : `${b}_${a}`;
    if (edgeMid.has(key)) return edgeMid.get(key);
    const pa = next.getPosition(a);
    const pb = next.getPosition(b);
    const idx = next.vertexCount;
    next.positions.push((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2);
    edgeMid.set(key, idx);
    return idx;
  };

  const existing = new Set(mesh.getEdges().map(([a, b]) => keyForEdge(a, b)));
  const keys = new Set(edgeKeys.filter((key) => existing.has(key)));
  if (keys.size === 0) return next;
  const newFaces = [];
  const newColors = [];

  for (let fi = 0; fi < next.faces.length; fi++) {
    const face = next.faces[fi];
    const color = next.faceColors[fi];
    let changed = false;
    const splitFace = [];

    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = keyForEdge(a, b);
      splitFace.push(a);
      if (keys.has(key)) {
        splitFace.push(getMid(a, b));
        changed = true;
      }
    }

    if (changed && splitFace.length >= 3) {
      newFaces.push(splitFace);
      newColors.push(color);
    } else {
      newFaces.push(face);
      newColors.push(color);
    }
  }

  next.faces = newFaces;
  next.faceColors = newColors;
  return next;
}

function averageUv(a = [0, 0], b = [0, 0]) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function clampLoopFactor(t) {
  return Math.max(0.02, Math.min(0.98, t));
}

/**
 * @param {number} cuts
 * @param {number} slideFactor
 */
export function loopCutFactors(cuts, slideFactor) {
  const n = Math.max(1, Math.min(32, Math.round(cuts)));
  if (n <= 1) return [clampLoopFactor(slideFactor)];
  const out = [];
  for (let i = 1; i <= n; i++) out.push(i / (n + 1));
  return out;
}

/**
 * Blender-style loop cut for quad rings: insert edge loop(s) parallel to the ring.
 * @param {EditableMesh} mesh
 * @param {string[]} ringEdgeKeys
 * @param {number | number[]} factorOrFactors — 0–1 along cross edges, or multiple cuts
 * @returns {{ mesh: EditableMesh, edgeKeys: string[], cutFaces: number }}
 */
export function loopCutEdges(mesh, ringEdgeKeys, factorOrFactors = 0.5) {
  const keys = new Set(ringEdgeKeys);
  if (keys.size === 0) return { mesh: mesh.clone(), edgeKeys: [], cutFaces: 0 };

  const factors = (
    Array.isArray(factorOrFactors) ? factorOrFactors : [factorOrFactors]
  )
    .map(clampLoopFactor)
    .sort((a, b) => a - b);

  const positions = [...mesh.positions];
  const pointCache = new Map();
  const pointOnEdge = (a, b, t, uvA, uvB) => {
    if (t <= 1e-6) return { vi: a, uv: uvA };
    if (t >= 1 - 1e-6) return { vi: b, uv: uvB };
    const cacheKey = `${keyForEdge(a, b)}@${t.toFixed(5)}`;
    if (pointCache.has(cacheKey)) return pointCache.get(cacheKey);
    const pa = mesh.getPosition(a);
    const pb = mesh.getPosition(b);
    const idx = positions.length / 3;
    positions.push(
      pa[0] + (pb[0] - pa[0]) * t,
      pa[1] + (pb[1] - pa[1]) * t,
      pa[2] + (pb[2] - pa[2]) * t,
    );
    const entry = {
      vi: idx,
      uv: [uvA[0] + (uvB[0] - uvA[0]) * t, uvA[1] + (uvB[1] - uvA[1]) * t],
    };
    pointCache.set(cacheKey, entry);
    return entry;
  };

  const faces = [];
  const colors = [];
  const faceUVs = [];
  const cutEdges = [];
  let cutFaces = 0;

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const color = mesh.faceColors[fi] ?? DEFAULT_PAINT_COLOR;
    const uvs = mesh.faceUVs[fi] ?? face.map(() => [0, 0]);

    if (face.length !== 4) {
      faces.push([...face]);
      colors.push(color);
      faceUVs.push(uvs.map(([u, v]) => [u, v]));
      continue;
    }

    let edgeIndex = -1;
    for (let i = 0; i < 4; i++) {
      if (keys.has(keyForEdge(face[i], face[(i + 1) % 4]))) {
        edgeIndex = i;
        break;
      }
    }

    if (edgeIndex < 0) {
      faces.push([...face]);
      colors.push(color);
      faceUVs.push(uvs.map(([u, v]) => [u, v]));
      continue;
    }

    const a = face[edgeIndex];
    const b = face[(edgeIndex + 1) % 4];
    const c = face[(edgeIndex + 2) % 4];
    const d = face[(edgeIndex + 3) % 4];
    const uvA = uvs[edgeIndex] ?? [0, 0];
    const uvB = uvs[(edgeIndex + 1) % 4] ?? [0, 0];
    const uvC = uvs[(edgeIndex + 2) % 4] ?? [0, 0];
    const uvD = uvs[(edgeIndex + 3) % 4] ?? [0, 0];

    const left = [{ vi: a, uv: uvA }];
    const right = [{ vi: d, uv: uvD }];
    for (const t of factors) {
      left.push(pointOnEdge(a, b, t, uvA, uvB));
      right.push(pointOnEdge(c, d, t, uvC, uvD));
    }
    left.push({ vi: b, uv: uvB });
    right.push({ vi: c, uv: uvC });

    for (let i = 0; i < left.length - 1; i++) {
      const p0 = left[i];
      const p1 = left[i + 1];
      const q0 = right[i];
      const q1 = right[i + 1];
      faces.push([p0.vi, p1.vi, q1.vi, q0.vi]);
      colors.push(color);
      faceUVs.push(
        [p0.uv, p1.uv, q1.uv, q0.uv].map(([u, v]) => [u, v]),
      );
      cutEdges.push(keyForEdge(p1.vi, q1.vi));
      cutFaces++;
    }
  }

  return {
    mesh: new EditableMesh({
      name: mesh.name,
      positions,
      faces,
      faceColors: colors,
      faceUVs,
    }),
    edgeKeys: [...new Set(cutEdges)],
    cutFaces,
  };
}

/**
 * @param {EditableMesh} mesh
 * @param {[number, number, number]} pos
 * @param {number} threshold
 */
export function findOrAddVertex(mesh, pos, threshold = 0.06) {
  for (let i = 0; i < mesh.vertexCount; i++) {
    const p = mesh.getPosition(i);
    const d = Math.hypot(p[0] - pos[0], p[1] - pos[1], p[2] - pos[2]);
    if (d <= threshold) return { mesh, index: i };
  }
  const next = mesh.clone();
  next.positions.push(pos[0], pos[1], pos[2]);
  return { mesh: next, index: next.vertexCount - 1 };
}

/**
 * @param {EditableMesh} mesh
 * @param {number[]} indices
 * @param {string} [color]
 */
export function addFace(mesh, indices, color) {
  const face = normalizedFace(indices);
  if (face.length < 3) return mesh;
  const next = mesh.clone();
  next.faces.push(face);
  next.faceColors.push(color ?? DEFAULT_PAINT_COLOR);
  next.normalizeFaceWinding();
  return next;
}

/**
 * @param {EditableMesh} mesh
 * @param {number[]} faceIndices
 */
export function getExtrudeAxis(mesh, faceIndices) {
  const n = new THREE.Vector3();
  for (const fi of faceIndices) {
    if (mesh.faces[fi]) n.add(mesh.getFaceNormal(fi));
  }
  if (n.lengthSq() < 1e-8) return new THREE.Vector3(0, 1, 0);
  return n.normalize();
}

/** @param {EditableMesh} mesh */
export function triangulateForExport(mesh) {
  const positions = [];
  const faces = [];
  let offset = 0;

  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const face = mesh.faces[fi];
    const faceVerts = face.map((vi) => {
      const p = mesh.getPosition(vi);
      positions.push(...p);
      const idx = offset++;
      return idx;
    });
    for (let i = 1; i < faceVerts.length - 1; i++) {
      faces.push([faceVerts[0], faceVerts[i], faceVerts[i + 1]]);
    }
  }
  return { positions, faces, name: mesh.name };
}

/**
 * Inset selected faces toward their centers, creating side quads.
 * @param {EditableMesh} mesh
 * @param {number[]} faceIndices
 * @param {number} amount — inset fraction 0–1
 */
export function insetFaces(mesh, faceIndices, amount = 0.25) {
  const next = mesh.clone();
  const selected = [...new Set(faceIndices)].filter((fi) => fi >= 0 && fi < mesh.faceCount);
  const t = Math.max(0.01, Math.min(0.99, amount));

  for (const fi of selected) {
    const face = mesh.faces[fi];
    if (!face || face.length < 3) continue;
    const center = mesh.getFaceCenter(fi);
    const capVerts = face.map((vi) => {
      const p = mesh.getPosition(vi);
      const newIdx = next.vertexCount;
      next.positions.push(
        p[0] + (center[0] - p[0]) * t,
        p[1] + (center[1] - p[1]) * t,
        p[2] + (center[2] - p[2]) * t,
      );
      return newIdx;
    });
    const color = next.faceColors[fi] ?? DEFAULT_PAINT_COLOR;
    const uvs = next.faceUVs[fi] ?? [];
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const ca = capVerts[i];
      const cb = capVerts[(i + 1) % face.length];
      next.faces.push([a, b, cb, ca]);
      next.faceColors.push(color);
      next.faceUVs.push([
        uvs[i] ?? [0, 0],
        uvs[(i + 1) % face.length] ?? [1, 0],
        uvs[(i + 1) % face.length] ?? [1, 1],
        uvs[i] ?? [0, 1],
      ]);
    }
    next.faces[fi] = capVerts;
    next.faceUVs[fi] = capVerts.map((_, i) => uvs[i] ?? [0, 0]);
  }
  next.normalizeFaceWinding();
  return next;
}

/**
 * Weld only the given vertex indices (or entire mesh when empty).
 * @param {EditableMesh} mesh
 * @param {number[]} vertexIndices
 * @param {number} threshold
 */
export function weldSelectedVertices(mesh, vertexIndices, threshold = 0.08) {
  const selected = [...new Set(vertexIndices)].filter((vi) => vi >= 0 && vi < mesh.vertexCount);
  if (selected.length === 0) return weldVertices(mesh, threshold);

  const next = mesh.clone();
  const parent = Array.from({ length: next.vertexCount }, (_, i) => i);
  const find = (i) => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const unite = (a, b) => {
    parent[find(a)] = find(b);
  };

  for (let i = 0; i < selected.length; i++) {
    for (let j = i + 1; j < selected.length; j++) {
      const a = selected[i];
      const b = selected[j];
      const pa = next.getPosition(a);
      const pb = next.getPosition(b);
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) <= threshold) unite(a, b);
    }
  }

  const groups = new Map();
  for (let i = 0; i < next.vertexCount; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  const newPositions = [];
  const indexMap = new Array(next.vertexCount);
  let idx = 0;
  for (const members of groups.values()) {
    const avg = [0, 0, 0];
    for (const vi of members) {
      const p = next.getPosition(vi);
      avg[0] += p[0];
      avg[1] += p[1];
      avg[2] += p[2];
    }
    avg[0] /= members.length;
    avg[1] /= members.length;
    avg[2] /= members.length;
    for (const vi of members) indexMap[vi] = idx;
    newPositions.push(...avg);
    idx++;
  }

  next.positions = newPositions;
  next.faces = next.faces.map((face) => face.map((vi) => indexMap[vi]));
  return next;
}

/**
 * Reduce vertex count by merging nearby vertices.
 * @param {EditableMesh} mesh
 * @param {number} ratio — target retention 0–1 (0.5 ≈ half detail)
 */
export function decimateMesh(mesh, ratio = 0.5) {
  const keep = Math.max(0.05, Math.min(1, ratio));
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < mesh.vertexCount; i++) {
    const p = mesh.getPosition(i);
    minX = Math.min(minX, p[0]);
    minY = Math.min(minY, p[1]);
    minZ = Math.min(minZ, p[2]);
    maxX = Math.max(maxX, p[0]);
    maxY = Math.max(maxY, p[1]);
    maxZ = Math.max(maxZ, p[2]);
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const threshold = diag * (1 - keep) * 0.15;
  return weldVertices(mesh, threshold);
}
