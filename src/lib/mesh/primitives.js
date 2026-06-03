import { EditableMesh } from './EditableMesh.js';

/** @type {Record<string, { label: string, create: () => EditableMesh }>} */
export const PRIMITIVES = {
  cube: {
    label: 'Cube',
    create: () =>
      new EditableMesh({
        name: 'Cube',
        positions: [
          -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
          -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        ],
        faces: [
          [0, 1, 2, 3],
          [4, 7, 6, 5],
          [0, 4, 5, 1],
          [1, 5, 6, 2],
          [2, 6, 7, 3],
          [4, 0, 3, 7],
        ],
      }),
  },
  plane: {
    label: 'Plane',
    create: () =>
      new EditableMesh({
        name: 'Plane',
        positions: [-0.7, 0, -0.7, 0.7, 0, -0.7, 0.7, 0, 0.7, -0.7, 0, 0.7],
        faces: [[0, 1, 2, 3]],
      }),
  },
  pyramid: {
    label: 'Pyramid',
    create: () => {
      const r = 0.75;
      const verts = [];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        verts.push(Math.cos(a) * r, -0.5, Math.sin(a) * r);
      }
      verts.push(0, 0.7, 0);
      return new EditableMesh({
        name: 'Pyramid',
        positions: verts.flat(),
        faces: [
          [0, 1, 2, 3],
          [0, 4, 1],
          [1, 4, 2],
          [2, 4, 3],
          [3, 4, 0],
        ],
      });
    },
  },
  cylinder: {
    label: 'Cylinder',
    create: () => buildCylinder(8, 0.55, 1.2),
  },
  cone: {
    label: 'Cone',
    create: () => buildCone(8, 0.65, 1.3),
  },
  sphere: {
    label: 'Sphere',
    create: () => buildSphere(10, 6, 0.65),
  },
  torus: {
    label: 'Torus',
    create: () => buildTorus(10, 6, 0.62, 0.2),
  },
  capsule: {
    label: 'Capsule',
    create: () => buildCapsule(8, 4, 0.4, 1.2),
  },
  octahedron: {
    label: 'Octahedron',
    create: () => buildOctahedron(0.75),
  },
  prism: {
    label: 'Prism',
    create: () => buildPrism(3, 0.75, 1.2),
  },
};

function buildCylinder(segments, radius, height) {
  const positions = [];
  const faces = [];
  const half = height / 2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, -half, Math.sin(a) * radius);
  }
  const topStart = segments;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, half, Math.sin(a) * radius);
  }
  for (let i = 0; i < segments; i++) {
    const a = i;
    const b = (i + 1) % segments;
    faces.push([a, b, topStart + b, topStart + a]);
  }
  const bottomCenter = positions.length / 3;
  const topCenter = bottomCenter + 1;
  positions.push(0, -half, 0, 0, half, 0);
  for (let i = 0; i < segments; i++) {
    faces.push([bottomCenter, (i + 1) % segments, i]);
    faces.push([topCenter, topStart + i, topStart + ((i + 1) % segments)]);
  }
  return new EditableMesh({ name: 'Cylinder', positions, faces });
}

function buildCone(segments, radius, height) {
  const positions = [];
  const faces = [];
  const half = height / 2;
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, -half, Math.sin(a) * radius);
  }
  const apex = segments;
  positions.push(0, half, 0);
  for (let i = 0; i < segments; i++) {
    faces.push([i, (i + 1) % segments, apex]);
  }
  const bottomCenter = positions.length / 3;
  positions.push(0, -half, 0);
  for (let i = 0; i < segments; i++) {
    faces.push([bottomCenter, (i + 1) % segments, i]);
  }
  return new EditableMesh({ name: 'Cone', positions, faces });
}

function buildSphere(segments, rings, radius) {
  const positions = [];
  const faces = [];
  for (let y = 0; y <= rings; y++) {
    const v = y / rings;
    const phi = v * Math.PI;
    for (let x = 0; x < segments; x++) {
      const u = x / segments;
      const theta = u * Math.PI * 2;
      positions.push(
        Math.sin(phi) * Math.cos(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.sin(theta) * radius,
      );
    }
  }
  for (let y = 0; y < rings; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * segments + x;
      const b = y * segments + ((x + 1) % segments);
      const c = (y + 1) * segments + ((x + 1) % segments);
      const d = (y + 1) * segments + x;
      faces.push([a, b, c, d]);
    }
  }
  return new EditableMesh({ name: 'Sphere', positions, faces });
}

function buildTorus(segments, sides, radius, tubeRadius) {
  const positions = [];
  const faces = [];
  for (let i = 0; i < segments; i++) {
    const u = (i / segments) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    for (let j = 0; j < sides; j++) {
      const v = (j / sides) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);
      const ring = radius + tubeRadius * cv;
      positions.push(ring * cu, tubeRadius * sv, ring * su);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      const c = ((i + 1) % segments) * sides + ((j + 1) % sides);
      const d = ((i + 1) % segments) * sides + j;
      faces.push([a, b, c, d]);
    }
  }
  return new EditableMesh({ name: 'Torus', positions, faces });
}

function buildCapsule(segments, hemiRings, radius, height) {
  const positions = [];
  const faces = [];
  const seg = Math.max(3, segments | 0);
  const ringsCount = Math.max(2, hemiRings | 0);
  const cylHalf = Math.max(0, height / 2 - radius);

  const topPole = positions.length / 3;
  positions.push(0, cylHalf + radius, 0);

  /** @type {number[][]} */
  const rings = [];
  const pushRing = (y, ringRadius) => {
    const row = [];
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      positions.push(Math.cos(a) * ringRadius, y, Math.sin(a) * ringRadius);
      row.push(positions.length / 3 - 1);
    }
    rings.push(row);
  };

  // Top hemisphere (excluding pole, including top equator).
  for (let i = 1; i <= ringsCount; i++) {
    const phi = (i / ringsCount) * (Math.PI / 2);
    pushRing(cylHalf + Math.cos(phi) * radius, Math.sin(phi) * radius);
  }

  // Bottom hemisphere (including bottom equator, excluding pole).
  for (let i = 1; i <= ringsCount; i++) {
    const phi = (i / ringsCount) * (Math.PI / 2);
    pushRing(-cylHalf - Math.cos((Math.PI / 2) - phi) * radius, Math.sin((Math.PI / 2) - phi) * radius);
  }

  const bottomPole = positions.length / 3;
  positions.push(0, -cylHalf - radius, 0);

  // Top cap triangles.
  if (rings.length > 0) {
    const first = rings[0];
    for (let i = 0; i < seg; i++) {
      faces.push([topPole, first[(i + 1) % seg], first[i]]);
    }
  }

  // Body quads between rings.
  for (let r = 0; r < rings.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = rings[r][i];
      const b = rings[r][(i + 1) % seg];
      const c = rings[r + 1][(i + 1) % seg];
      const d = rings[r + 1][i];
      faces.push([a, b, c, d]);
    }
  }

  // Bottom cap triangles.
  if (rings.length > 0) {
    const last = rings[rings.length - 1];
    for (let i = 0; i < seg; i++) {
      faces.push([last[i], last[(i + 1) % seg], bottomPole]);
    }
  }
  return new EditableMesh({ name: 'Capsule', positions, faces });
}

function buildOctahedron(radius) {
  const positions = [
    0, radius, 0,
    radius, 0, 0,
    0, 0, radius,
    -radius, 0, 0,
    0, 0, -radius,
    0, -radius, 0,
  ];
  const faces = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 4],
    [0, 4, 1],
    [5, 2, 1],
    [5, 3, 2],
    [5, 4, 3],
    [5, 1, 4],
  ];
  return new EditableMesh({ name: 'Octahedron', positions, faces });
}

function buildPrism(sides, radius, height) {
  const positions = [];
  const faces = [];
  const half = height / 2;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, -half, Math.sin(a) * radius);
  }
  const topStart = sides;
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    positions.push(Math.cos(a) * radius, half, Math.sin(a) * radius);
  }
  for (let i = 0; i < sides; i++) {
    const a = i;
    const b = (i + 1) % sides;
    faces.push([a, b, topStart + b, topStart + a]);
  }
  faces.push([...Array(sides).keys()].reverse());
  faces.push([...Array(sides).keys()].map((i) => topStart + i));
  return new EditableMesh({ name: 'Prism', positions, faces });
}

/** Unit-space bounding size [width, height, depth] for scaling into a draw box. */
export const PRIMITIVE_BOUNDS = {
  cube: [1, 1, 1],
  plane: [1.4, 0.05, 1.4],
  pyramid: [1.5, 1.2, 1.5],
  cylinder: [1.1, 1.2, 1.1],
  cone: [1.3, 1.3, 1.3],
  sphere: [1.3, 1.3, 1.3],
  torus: [1.7, 0.5, 1.7],
  capsule: [0.9, 1.8, 0.9],
  octahedron: [1.5, 1.5, 1.5],
  prism: [1.4, 1.2, 1.4],
};

const DRAW_VIEW_AXIS_MAP = {
  top: [0, 1, 2],
  bottom: [0, 1, 2],
  perspective: [0, 1, 2],
  front: [0, 2, 1],
  back: [0, 2, 1],
  right: [1, 0, 2],
  left: [1, 0, 2],
};

function isOddAxisPermutation(axisMap) {
  let inversions = 0;
  for (let i = 0; i < axisMap.length; i++) {
    for (let j = i + 1; j < axisMap.length; j++) {
      if (axisMap[i] > axisMap[j]) inversions++;
    }
  }
  return inversions % 2 === 1;
}

/**
 * Remap primitive-local axes so local Y is the viewport depth direction.
 * This makes drawn cylinders, cones, planes, etc. stand out from the view used to draw them.
 * @param {EditableMesh} mesh
 * @param {string} viewId
 */
export function orientPrimitiveForDrawView(mesh, viewId) {
  const axisMap = DRAW_VIEW_AXIS_MAP[viewId] ?? DRAW_VIEW_AXIS_MAP.perspective;
  if (axisMap[0] === 0 && axisMap[1] === 1 && axisMap[2] === 2) return mesh;

  const next = mesh.clone();
  for (let i = 0; i < next.vertexCount; i++) {
    const local = next.getPosition(i);
    const world = [0, 0, 0];
    for (let axis = 0; axis < 3; axis++) {
      world[axisMap[axis]] = local[axis];
    }
    next.setPosition(i, world[0], world[1], world[2]);
  }

  if (isOddAxisPermutation(axisMap)) {
    next.faces = next.faces.map((face) => [...face].reverse());
    next.faceUVs = next.faceUVs.map((uvs) => [...uvs].reverse());
  }

  return next;
}

export function createPrimitive(type) {
  const def = PRIMITIVES[type];
  if (!def) return PRIMITIVES.cube.create();
  return def.create();
}

export function createPrimitiveForDrawView(type, viewId) {
  return orientPrimitiveForDrawView(createPrimitive(type), viewId);
}

/**
 * Scale factors to fit mesh into a world-space box size.
 * @param {string} type
 * @param {[number, number, number]} boxSize
 */
export function scaleForBox(type, boxSize, viewId = 'perspective') {
  const bounds = PRIMITIVE_BOUNDS[type] ?? PRIMITIVE_BOUNDS.cube;
  const axisMap = DRAW_VIEW_AXIS_MAP[viewId] ?? DRAW_VIEW_AXIS_MAP.perspective;
  const remappedBounds = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    remappedBounds[axisMap[axis]] = bounds[axis];
  }
  return [
    boxSize[0] / remappedBounds[0],
    boxSize[1] / remappedBounds[1],
    boxSize[2] / remappedBounds[2],
  ];
}
