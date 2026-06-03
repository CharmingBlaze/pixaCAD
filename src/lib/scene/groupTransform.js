import * as THREE from 'three';
import { localToWorld, objectMatrix } from '../mesh/transform.js';

/** @typedef {import('../../store/editorStore.js').SceneObject} SceneObject */

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _world = new THREE.Matrix4();
const _local = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _sum = new THREE.Vector3();
const _tmp = new THREE.Vector3();

/**
 * @param {SceneObject[]} objects
 * @param {SceneObject} object
 */
export function getObjectWorldMatrix(objects, object) {
  const chain = [];
  let cur = object;
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? objects.find((o) => o.id === cur.parentId) : null;
  }
  _m.identity();
  for (const node of chain) {
    _m.multiply(objectMatrix(node));
  }
  return _m.clone();
}

/**
 * @param {THREE.Matrix4} matrix
 */
export function decomposeTransform(matrix) {
  matrix.decompose(_pos, _quat, _scale);
  const euler = new THREE.Euler().setFromQuaternion(_quat);
  return {
    position: /** @type {[number, number, number]} */ ([_pos.x, _pos.y, _pos.z]),
    rotation: /** @type {[number, number, number]} */ ([euler.x, euler.y, euler.z]),
    scale: /** @type {[number, number, number]} */ ([_scale.x, _scale.y, _scale.z]),
  };
}

/**
 * World-space pivot (centroid of member origins).
 * @param {SceneObject[]} objects
 * @param {SceneObject[]} members
 */
export function computeGroupPivot(objects, members) {
  if (members.length === 0) return /** @type {[number, number, number]} */ ([0, 0, 0]);
  _sum.set(0, 0, 0);
  for (const member of members) {
    getObjectWorldMatrix(objects, member).decompose(_tmp, _quat, _scale);
    _sum.add(_tmp);
  }
  _sum.multiplyScalar(1 / members.length);
  return [_sum.x, _sum.y, _sum.z];
}

/**
 * World-space pivot at the center of selected geometry (mesh vertex centroid).
 * Falls back to object origins when no mesh data exists.
 * @param {SceneObject[]} objects
 * @param {SceneObject[]} members
 */
export function computeSelectionGeometryPivotWorld(objects, members) {
  if (members.length === 0) return /** @type {[number, number, number]} */ ([0, 0, 0]);

  _sum.set(0, 0, 0);
  let count = 0;

  for (const member of members) {
    if (member.mesh?.positions?.length >= 3) {
      const positions = member.mesh.positions;
      for (let i = 0; i < positions.length; i += 3) {
        const world = localToWorld([positions[i], positions[i + 1], positions[i + 2]], member, objects);
        _sum.x += world[0];
        _sum.y += world[1];
        _sum.z += world[2];
        count += 1;
      }
      continue;
    }

    getObjectWorldMatrix(objects, member).decompose(_tmp, _quat, _scale);
    _sum.add(_tmp);
    count += 1;
  }

  if (count === 0) return computeGroupPivot(objects, members);
  _sum.multiplyScalar(1 / count);
  return [_sum.x, _sum.y, _sum.z];
}

/**
 * @param {SceneObject[]} objects
 * @param {SceneObject} member
 * @param {SceneObject} group
 */
export function memberLocalTransform(objects, member, group) {
  _world.copy(getObjectWorldMatrix(objects, member));
  _inv.copy(objectMatrix(group)).invert();
  _local.copy(_inv).multiply(_world);
  return decomposeTransform(_local);
}

/**
 * Reparent members under a new group; returns updated member rows + group row.
 * @param {SceneObject[]} objects
 * @param {SceneObject[]} members
 * @param {string} groupId
 */
export function buildGroupedObjects(objects, members, groupId) {
  const pivot = computeGroupPivot(objects, members);
  const group = {
    id: groupId,
    name: `Group_${objects.filter((o) => o.isGroup).length + 1}`,
    parentId: null,
    isGroup: true,
    mesh: null,
    position: pivot,
    rotation: /** @type {[number, number, number]} */ ([0, 0, 0]),
    scale: /** @type {[number, number, number]} */ ([1, 1, 1]),
    textureDataUrl: null,
    textureLayers: [],
    visible: true,
    locked: false,
  };

  const groupMatrix = objectMatrix(group);
  const updatedMembers = members.map((member) => {
    const local = memberLocalTransform(objects, member, group);
    return {
      ...member,
      parentId: groupId,
      position: local.position,
      rotation: local.rotation,
      scale: local.scale,
    };
  });

  return { group, members: updatedMembers };
}

/**
 * Bake children to world space and detach from group.
 * @param {SceneObject[]} objects
 * @param {string} groupId
 */
export function ungroupChildren(objects, groupId) {
  const group = objects.find((o) => o.id === groupId);
  if (!group?.isGroup) return [];

  const grandParent = group.parentId;
  const children = objects.filter((o) => o.parentId === groupId);
  return children.map((child) => {
    const world = decomposeTransform(getObjectWorldMatrix(objects, child));
    return {
      ...child,
      parentId: grandParent,
      position: world.position,
      rotation: world.rotation,
      scale: world.scale,
    };
  });
}

/**
 * Axis-aligned bounds in group-local space for hit-testing / gizmo sizing.
 * @param {SceneObject[]} objects
 * @param {SceneObject} group
 * @param {SceneObject[]} children
 */
/**
 * @param {[number, number, number]} worldPos
 * @param {SceneObject[]} objects
 * @param {SceneObject} object
 */
export function worldPositionToObjectLocal(worldPos, objects, object) {
  if (!object.parentId) return worldPos;
  const parent = objects.find((o) => o.id === object.parentId);
  if (!parent) return worldPos;
  _inv.copy(getObjectWorldMatrix(objects, parent)).invert();
  _tmp.set(worldPos[0], worldPos[1], worldPos[2]);
  _tmp.applyMatrix4(_inv);
  return [_tmp.x, _tmp.y, _tmp.z];
}

export function computeGroupLocalBounds(objects, group, children) {
  if (children.length === 0) {
    return { center: [0, 0, 0], size: [0.4, 0.4, 0.4] };
  }

  _inv.copy(objectMatrix(group)).invert();
  const box = new THREE.Box3();
  let hasPoint = false;

  for (const child of children) {
    getObjectWorldMatrix(objects, child).decompose(_pos, _quat, _scale);
    _pos.applyMatrix4(_inv);
    box.expandByPoint(_pos);
    hasPoint = true;

    if (child.mesh?.positions?.length) {
      const wm = getObjectWorldMatrix(objects, child);
      for (let i = 0; i < child.mesh.positions.length; i += 3) {
        _tmp.set(child.mesh.positions[i], child.mesh.positions[i + 1], child.mesh.positions[i + 2]);
        _tmp.applyMatrix4(wm);
        _tmp.applyMatrix4(_inv);
        box.expandByPoint(_tmp);
        hasPoint = true;
      }
    }
  }

  if (!hasPoint) {
    return { center: [0, 0, 0], size: [0.4, 0.4, 0.4] };
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const pad = 0.15;
  return {
    center: [center.x, center.y, center.z],
    size: [
      Math.max(0.25, size.x + pad),
      Math.max(0.25, size.y + pad),
      Math.max(0.25, size.z + pad),
    ],
  };
}
