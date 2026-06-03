import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore.js';
import { SELECTION } from '../../lib/mesh/selectionTheme.js';

const _obj = new THREE.Object3D();

const DEFAULT_CUBE = 0.075;
const HOVER_CUBE = 0.11;
const SELECTED_CUBE = 0.12;
/** World-space shell thickness (~1–2 px at typical zoom) added per side of the marker cube. */
const OUTLINE_WORLD_PADDING = 0.006;
const MIN_SCALE_AXIS = 0.0001;

/** @param {number} markerSize */
function markerOutlineSize(markerSize) {
  return markerSize + OUTLINE_WORLD_PADDING * 2;
}
const DEPTH_OPACITY = {
  near: 1,
  mid: 0.74,
  far: 0.46,
};

/**
 * @param {number} index
 * @param {[number, number, number][] | null} points
 * @param {import('../../lib/mesh/EditableMesh.js').EditableMesh | null} mesh
 */
function getPoint(index, points, mesh) {
  if (points) return points[index];
  if (mesh) return mesh.getPosition(index);
  return [0, 0, 0];
}

function DepthMarkerGroup({
  indices,
  boxGeometry,
  mesh,
  points,
  size,
  outlineSize,
  opacity,
  color,
  outlineColor,
  markerMat,
  outlineMat,
  markerEvents,
  inverseParentScale,
}) {
  const markerRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const outlineRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const meshRevision = useEditorStore((s) => s.meshRevision);

  const update = (ref, markerSize) => {
    const im = ref.current;
    if (!im) return;
    for (let j = 0; j < indices.length; j++) {
      const p = getPoint(indices[j], points, mesh);
      _obj.position.set(p[0], p[1], p[2]);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.set(
        markerSize * inverseParentScale[0],
        markerSize * inverseParentScale[1],
        markerSize * inverseParentScale[2],
      );
      _obj.updateMatrix();
      im.setMatrixAt(j, _obj.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    update(markerRef, size);
    update(outlineRef, outlineSize);
  }, [indices, mesh, meshRevision, points, size, outlineSize, inverseParentScale]);

  if (indices.length === 0) return null;

  return (
    <>
      <instancedMesh
        ref={outlineRef}
        args={[boxGeometry, undefined, indices.length]}
        renderOrder={999}
        frustumCulled={false}
      >
        <meshBasicMaterial color={outlineColor} opacity={opacity} transparent {...outlineMat} />
      </instancedMesh>
      <instancedMesh
        ref={markerRef}
        args={[boxGeometry, undefined, indices.length]}
        renderOrder={1000}
        frustumCulled={false}
        {...markerEvents(indices)}
      >
        <meshBasicMaterial color={color} opacity={opacity} transparent {...markerMat} />
      </instancedMesh>
    </>
  );
}

/**
 * Blockbench-style tiny cube vertex markers (picking via SubObjectPicker).
 */
export function VertexMarkers({
  mesh = null,
  points = null,
  selectedVertices = [],
  hoveredVertex = null,
  defaultColor = SELECTION.vertexIdle,
  selectedColor = SELECTION.selected,
  hoverColor = SELECTION.hover,
  outlineColor = SELECTION.vertexOutline,
  cubeSize = DEFAULT_CUBE,
  hoverCubeSize = HOVER_CUBE,
  selectedCubeSize = SELECTED_CUBE,
  parentScale = [1, 1, 1],
  xray = true,
  depthBuckets = null,
}) {
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const setHoveredVertex = useEditorStore((s) => s.setHoveredVertex);
  const unselectedOutlineRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const unselectedRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const hoverOutlineRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const hoverRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const selectedOutlineRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const selectedRef = useRef(/** @type {THREE.InstancedMesh | null} */ (null));
  const boxGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const selectedSet = useMemo(() => new Set(selectedVertices), [selectedVertices]);
  const inverseParentScale = useMemo(
    () => [
      1 / Math.max(Math.abs(parentScale[0] ?? 1), MIN_SCALE_AXIS),
      1 / Math.max(Math.abs(parentScale[1] ?? 1), MIN_SCALE_AXIS),
      1 / Math.max(Math.abs(parentScale[2] ?? 1), MIN_SCALE_AXIS),
    ],
    [parentScale],
  );

  const vertexCount = points ? points.length : mesh?.vertexCount ?? 0;

  const { unselectedNear, unselectedMid, unselectedFar, hoverIndices, selectedIndices } = useMemo(() => {
    const unselectedNear = [];
    const unselectedMid = [];
    const unselectedFar = [];
    const unselectedIndices = [];
    const hoverIndices = [];
    const selectedIndices = [];
    for (let i = 0; i < vertexCount; i++) {
      if (selectedSet.has(i)) selectedIndices.push(i);
      else if (hoveredVertex === i) hoverIndices.push(i);
      else {
        unselectedIndices.push(i);
        const bucket = depthBuckets?.[i] ?? 'near';
        if (bucket === 'far') unselectedFar.push(i);
        else if (bucket === 'mid') unselectedMid.push(i);
        else unselectedNear.push(i);
      }
    }
    return { unselectedNear, unselectedMid, unselectedFar, hoverIndices, selectedIndices };
  }, [vertexCount, selectedSet, hoveredVertex, depthBuckets]);

  const updateInstances = (ref, indices, size) => {
    const im = ref.current;
    if (!im) return;
    for (let j = 0; j < indices.length; j++) {
      const p = getPoint(indices[j], points, mesh);
      _obj.position.set(p[0], p[1], p[2]);
      _obj.rotation.set(0, 0, 0);
      _obj.scale.set(
        size * inverseParentScale[0],
        size * inverseParentScale[1],
        size * inverseParentScale[2],
      );
      _obj.updateMatrix();
      im.setMatrixAt(j, _obj.matrix);
    }
    im.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    updateInstances(unselectedRef, unselectedNear, cubeSize);
    updateInstances(unselectedOutlineRef, unselectedNear, markerOutlineSize(cubeSize));
  }, [unselectedNear, mesh, meshRevision, points, cubeSize, inverseParentScale]);

  useLayoutEffect(() => {
    updateInstances(hoverRef, hoverIndices, hoverCubeSize);
    updateInstances(hoverOutlineRef, hoverIndices, markerOutlineSize(hoverCubeSize));
  }, [hoverIndices, mesh, meshRevision, points, hoverCubeSize, inverseParentScale]);

  useLayoutEffect(() => {
    updateInstances(selectedRef, selectedIndices, selectedCubeSize);
    updateInstances(selectedOutlineRef, selectedIndices, markerOutlineSize(selectedCubeSize));
  }, [selectedIndices, mesh, meshRevision, points, selectedCubeSize, inverseParentScale]);

  useEffect(() => () => boxGeometry.dispose(), [boxGeometry]);

  const markerMat = { toneMapped: false, depthTest: !xray, depthWrite: false };
  const outlineMat = { toneMapped: false, depthTest: !xray, depthWrite: false, side: THREE.BackSide };
  const markerEvents = (indices) =>
    mesh
      ? {
          onPointerMove: (e) => {
            const index = indices[e.instanceId];
            if (index === undefined) return;
            e.stopPropagation();
            setHoveredVertex(index);
          },
        }
      : {};

  return (
    <group renderOrder={1000}>
      {unselectedNear.length > 0 && (
        <>
          <instancedMesh
            ref={unselectedOutlineRef}
            args={[boxGeometry, undefined, unselectedNear.length]}
            renderOrder={1000}
            frustumCulled={false}
          >
            <meshBasicMaterial color={outlineColor} opacity={DEPTH_OPACITY.near} transparent {...outlineMat} />
          </instancedMesh>
          <instancedMesh
            ref={unselectedRef}
            args={[boxGeometry, undefined, unselectedNear.length]}
            renderOrder={1001}
            frustumCulled={false}
            {...markerEvents(unselectedNear)}
          >
            <meshBasicMaterial color={defaultColor} opacity={DEPTH_OPACITY.near} transparent {...markerMat} />
          </instancedMesh>
        </>
      )}
      <DepthMarkerGroup
        indices={unselectedMid}
        boxGeometry={boxGeometry}
        mesh={mesh}
        points={points}
        size={cubeSize}
        outlineSize={markerOutlineSize(cubeSize)}
        opacity={DEPTH_OPACITY.mid}
        color={defaultColor}
        outlineColor={outlineColor}
        markerMat={markerMat}
        outlineMat={outlineMat}
        markerEvents={markerEvents}
        inverseParentScale={inverseParentScale}
      />
      <DepthMarkerGroup
        indices={unselectedFar}
        boxGeometry={boxGeometry}
        mesh={mesh}
        points={points}
        size={cubeSize}
        outlineSize={markerOutlineSize(cubeSize)}
        opacity={DEPTH_OPACITY.far}
        color={defaultColor}
        outlineColor={outlineColor}
        markerMat={markerMat}
        outlineMat={outlineMat}
        markerEvents={markerEvents}
        inverseParentScale={inverseParentScale}
      />
      {hoverIndices.length > 0 && (
        <>
          <instancedMesh
            ref={hoverOutlineRef}
            args={[boxGeometry, undefined, hoverIndices.length]}
            renderOrder={1002}
            frustumCulled={false}
          >
            <meshBasicMaterial color={outlineColor} {...outlineMat} />
          </instancedMesh>
          <instancedMesh
            ref={hoverRef}
            args={[boxGeometry, undefined, hoverIndices.length]}
            renderOrder={1003}
            frustumCulled={false}
            {...markerEvents(hoverIndices)}
          >
            <meshBasicMaterial color={hoverColor} {...markerMat} />
          </instancedMesh>
        </>
      )}
      {selectedIndices.length > 0 && (
        <>
          <instancedMesh
            ref={selectedOutlineRef}
            args={[boxGeometry, undefined, selectedIndices.length]}
            renderOrder={1004}
            frustumCulled={false}
          >
            <meshBasicMaterial color={outlineColor} {...outlineMat} />
          </instancedMesh>
          <instancedMesh
            ref={selectedRef}
            args={[boxGeometry, undefined, selectedIndices.length]}
            renderOrder={1005}
            frustumCulled={false}
            {...markerEvents(selectedIndices)}
          >
            <meshBasicMaterial color={selectedColor} {...markerMat} />
          </instancedMesh>
        </>
      )}
    </group>
  );
}
