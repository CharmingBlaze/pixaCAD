import * as THREE from 'three';
import { DEFAULT_PAINT_COLOR } from '../defaultColors.js';

/** @typedef {number[]} FaceIndices */

export class EditableMesh {
  /**
   * @param {{ name?: string, positions: number[], faces: FaceIndices[], faceColors?: string[], faceUVs?: [number, number][][], uvSeamEdges?: string[], sharpEdges?: string[] }} data
   */
  constructor({ name = 'Mesh', positions, faces, faceColors, faceUVs, uvSeamEdges, sharpEdges }) {
    this.name = name;
    this.positions = [...positions];
    this.faces = faces.map((f) => [...f]);
    this.faceColors = faceColors
      ? [...faceColors]
      : faces.map(() => DEFAULT_PAINT_COLOR);
    this.faceUVs = faceUVs
      ? faceUVs.map((uvs) => uvs.map((uv) => /** @type {[number, number]} */ ([uv[0], uv[1]])))
      : this.faces.map((face, faceIndex) => this.createDefaultFaceUVs(face, faceIndex));
    this.uvSeamEdges = [...(uvSeamEdges ?? [])];
    this.sharpEdges = [...(sharpEdges ?? [])];
  }

  clone() {
    return new EditableMesh({
      name: this.name,
      positions: [...this.positions],
      faces: this.faces.map((f) => [...f]),
      faceColors: [...this.faceColors],
      faceUVs: this.faceUVs.map((uvs) => uvs.map((uv) => /** @type {[number, number]} */ ([uv[0], uv[1]]))),
      uvSeamEdges: [...this.uvSeamEdges],
      sharpEdges: [...this.sharpEdges],
    });
  }

  /** @param {string} color */
  setUniformFaceColor(color) {
    this.faceColors = this.faces.map(() => color);
  }

  createDefaultFaceUVs(face, faceIndex) {
    const columns = Math.max(1, Math.ceil(Math.sqrt(this.faces.length || 1)));
    const rows = Math.max(1, Math.ceil((this.faces.length || 1) / columns));
    const cellW = 1 / columns;
    const cellH = 1 / rows;
    const col = faceIndex % columns;
    const row = Math.floor(faceIndex / columns);
    const inset = Math.min(cellW, cellH) * 0.08;
    const minU = col * cellW + inset;
    const maxU = (col + 1) * cellW - inset;
    const minV = row * cellH + inset;
    const maxV = (row + 1) * cellH - inset;

    if (face.length === 3) {
      return [
        [minU, minV],
        [maxU, minV],
        [(minU + maxU) / 2, maxV],
      ];
    }

    if (face.length === 4) {
      return [
        [minU, minV],
        [maxU, minV],
        [maxU, maxV],
        [minU, maxV],
      ];
    }

    return face.map((_, i) => {
      const t = i / face.length;
      const x = Math.cos(t * Math.PI * 2);
      const y = Math.sin(t * Math.PI * 2);
      return [
        (minU + maxU) / 2 + (x * (maxU - minU)) / 2,
        (minV + maxV) / 2 + (y * (maxV - minV)) / 2,
      ];
    });
  }

  get vertexCount() {
    return this.positions.length / 3;
  }

  get faceCount() {
    return this.faces.length;
  }

  getPosition(i) {
    const o = i * 3;
    return [this.positions[o], this.positions[o + 1], this.positions[o + 2]];
  }

  setPosition(i, x, y, z) {
    const o = i * 3;
    this.positions[o] = x;
    this.positions[o + 1] = y;
    this.positions[o + 2] = z;
  }

  /** @param {THREE.Matrix4} matrix */
  applyMatrix(matrix) {
    const v = new THREE.Vector3();
    for (let i = 0; i < this.vertexCount; i++) {
      v.fromArray(this.positions, i * 3);
      v.applyMatrix4(matrix);
      v.toArray(this.positions, i * 3);
    }
  }

  toBufferGeometry() {
    const positions = [];
    const colors = [];
    const uvs = [];

    const pushTri = (indices, colorHex) => {
      const c = new THREE.Color(colorHex);
      const faceIndex = this.faces.indexOf(indices);
      const faceUVs = this.faceUVs[faceIndex] ?? this.createDefaultFaceUVs(indices, faceIndex);
      for (let i = 1; i < indices.length - 1; i++) {
        const tri = [
          { vi: indices[0], uvi: 0 },
          { vi: indices[i], uvi: i },
          { vi: indices[i + 1], uvi: i + 1 },
        ];
        for (const { vi, uvi } of tri) {
          positions.push(...this.getPosition(vi));
          colors.push(c.r, c.g, c.b);
          const uv = faceUVs[uvi] ?? [0, 0];
          uvs.push(uv[0], uv[1]);
        }
      }
    };

    for (let fi = 0; fi < this.faces.length; fi++) {
      pushTri(this.faces[fi], this.faceColors[fi] ?? DEFAULT_PAINT_COLOR);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.computeVertexNormals();
    return geom;
  }

  getEdges() {
    const seen = new Set();
    const edges = [];
    for (const face of this.faces) {
      for (let i = 0; i < face.length; i++) {
        const a = face[i];
        const b = face[(i + 1) % face.length];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([a, b]);
        }
      }
    }
    return edges;
  }

  getFaceCenter(faceIndex) {
    const face = this.faces[faceIndex];
    const c = [0, 0, 0];
    for (const vi of face) {
      const p = this.getPosition(vi);
      c[0] += p[0];
      c[1] += p[1];
      c[2] += p[2];
    }
    const n = face.length;
    return [c[0] / n, c[1] / n, c[2] / n];
  }

  getMeshCentroid() {
    const center = new THREE.Vector3();
    const count = this.vertexCount;
    if (count === 0) return center;
    for (let i = 0; i < count; i++) {
      center.add(new THREE.Vector3(...this.getPosition(i)));
    }
    return center.multiplyScalar(1 / count);
  }

  getFaceNormal(faceIndex) {
    const face = this.faces[faceIndex];
    if (!face || face.length < 3) return new THREE.Vector3(0, 1, 0);

    const normal = new THREE.Vector3();
    if (face.length === 3) {
      const p0 = new THREE.Vector3(...this.getPosition(face[0]));
      const p1 = new THREE.Vector3(...this.getPosition(face[1]));
      const p2 = new THREE.Vector3(...this.getPosition(face[2]));
      normal.subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
    } else {
      for (let i = 0; i < face.length; i++) {
        const cur = this.getPosition(face[i]);
        const nxt = this.getPosition(face[(i + 1) % face.length]);
        normal.x += (cur[1] - nxt[1]) * (cur[2] + nxt[2]);
        normal.y += (cur[2] - nxt[2]) * (cur[0] + nxt[0]);
        normal.z += (cur[0] - nxt[0]) * (cur[1] + nxt[1]);
      }
    }

    if (normal.lengthSq() < 1e-10) return new THREE.Vector3(0, 1, 0);
    normal.normalize();

    const faceCenter = new THREE.Vector3();
    for (const vi of face) {
      faceCenter.add(new THREE.Vector3(...this.getPosition(vi)));
    }
    faceCenter.multiplyScalar(1 / face.length);

    const outward = faceCenter.sub(this.getMeshCentroid());
    if (normal.dot(outward) < 0) normal.negate();

    return normal;
  }
}
