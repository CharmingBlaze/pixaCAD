/**
 * Snap a world-space point to nearby mesh vertices or edge midpoints.
 * @param {[number, number, number]} point
 * @param {import('../mesh/EditableMesh.js').EditableMesh} mesh
 * @param {import('three').Matrix4} worldMatrix
 * @param {number} threshold
 * @returns {[number, number, number] | null}
 */
export function snapPointToMeshFeatures(point, mesh, worldMatrix, threshold = 0.15) {
  if (!mesh || threshold <= 0) return null;
  const inv = worldMatrix.clone().invert();
  const local = [
    point[0] * inv.elements[0] + point[1] * inv.elements[4] + point[2] * inv.elements[8] + inv.elements[12],
    point[0] * inv.elements[1] + point[1] * inv.elements[5] + point[2] * inv.elements[9] + inv.elements[13],
    point[0] * inv.elements[2] + point[1] * inv.elements[6] + point[2] * inv.elements[10] + inv.elements[14],
  ];

  let best = null;
  let bestDist = threshold;

  for (let vi = 0; vi < mesh.vertexCount; vi++) {
    const p = mesh.getPosition(vi);
    const d = Math.hypot(local[0] - p[0], local[1] - p[1], local[2] - p[2]);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }

  const seen = new Set();
  for (const face of mesh.faces) {
    for (let i = 0; i < face.length; i++) {
      const a = face[i];
      const b = face[(i + 1) % face.length];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const pa = mesh.getPosition(a);
      const pb = mesh.getPosition(b);
      const mid = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, (pa[2] + pb[2]) / 2];
      const d = Math.hypot(local[0] - mid[0], local[1] - mid[1], local[2] - mid[2]);
      if (d < bestDist) {
        bestDist = d;
        best = mid;
      }
    }
  }

  if (!best) return null;
  return [
    best[0] * worldMatrix.elements[0] + best[1] * worldMatrix.elements[4] + best[2] * worldMatrix.elements[8] + worldMatrix.elements[12],
    best[0] * worldMatrix.elements[1] + best[1] * worldMatrix.elements[5] + best[2] * worldMatrix.elements[9] + worldMatrix.elements[13],
    best[0] * worldMatrix.elements[2] + best[1] * worldMatrix.elements[6] + best[2] * worldMatrix.elements[10] + worldMatrix.elements[14],
  ];
}
