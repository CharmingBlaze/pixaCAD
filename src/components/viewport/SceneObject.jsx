import { useEffect, useMemo, useRef, useState } from 'react';
import { computeGroupLocalBounds, getObjectWorldMatrix, worldPositionToObjectLocal } from '../../lib/scene/groupTransform.js';
import { resolveInteractiveObjectIds } from '../../lib/scene/objectInteractiveTransform.js';
import { useDisposableMeshGeometry, useDisposableMeshOutlineGeometry } from '../../hooks/useMeshGeometry.js';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getLiveTextureCanvas, useEditorStore } from '../../store/editorStore.js';
import { coalesceSelectedIds, isObjectSelected } from '../../store/objectSelection.js';
import { canViewportPickObject } from '../../store/interaction.js';
import { selectModeFromEvent } from '../../store/selection.js';
import { objectSnapGrid, snapVector3Components } from '../../lib/snap/gridSnap.js';
import { verticesFromEdgeKeys, verticesFromFaceIndices } from '../../lib/mesh/edgeKeys.js';
import { evaluateObjectMesh } from '../../lib/mesh/modifiers.js';
import { SubObjectOverlay } from './SubObjectOverlay.jsx';
import { VertexTransformControls } from './VertexTransformControls.jsx';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';

const DRAG_THRESHOLD_PX = 4;
const _ndc = new THREE.Vector2();
const _raycaster = new THREE.Raycaster();
const _dragPlane = new THREE.Plane();
const _cameraDir = new THREE.Vector3();
const _hit = new THREE.Vector3();
const _startHit = new THREE.Vector3();
const _startPos = new THREE.Vector3();
const _dragQuat = new THREE.Quaternion();
const _dragScale = new THREE.Vector3();

function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function triangleToFaceIndex(mesh, triangleIndex) {
  if (!mesh || !Number.isInteger(triangleIndex) || triangleIndex < 0) return -1;
  let triCursor = 0;
  for (let fi = 0; fi < mesh.faces.length; fi++) {
    const tris = Math.max(0, (mesh.faces[fi]?.length ?? 0) - 2);
    if (triangleIndex < triCursor + tris) return fi;
    triCursor += tris;
  }
  return -1;
}

function syncObjectTransform(group, object) {
  group.position.fromArray(object.position);
  group.rotation.set(object.rotation[0], object.rotation[1], object.rotation[2]);
  group.scale.fromArray(object.scale);
}

function FaceNormalsOverlay({ mesh, selected }) {
  const geometry = useMemo(() => {
    if (!mesh || mesh.faceCount === 0) return null;
    const positions = [];
    const colors = [];
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

    const diagonal = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
    const length = Math.max(0.08, diagonal * 0.12);
    const outwardColor = selected ? [0.25, 0.85, 1] : [0.1, 0.65, 1];
    const inwardColor = [1, 0.18, 0.1];

    for (let fi = 0; fi < mesh.faceCount; fi++) {
      const face = mesh.faces[fi];
      if (!face || face.length < 3) continue;
      const center = mesh.getFaceCenter(fi);
      const normal = mesh.getFaceNormal(fi);
      const end = [
        center[0] + normal.x * length,
        center[1] + normal.y * length,
        center[2] + normal.z * length,
      ];
      const color = mesh.shouldReverseFaceWinding(fi) ? inwardColor : outwardColor;
      positions.push(...center, ...end);
      colors.push(...color, ...color);
    }

    const normalGeometry = new THREE.BufferGeometry();
    normalGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    normalGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return normalGeometry;
  }, [mesh, selected]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;

  return (
    <lineSegments geometry={geometry} renderOrder={5} raycast={() => null}>
      <lineBasicMaterial vertexColors transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} />
    </lineSegments>
  );
}

/**
 * Group pick volume + outer-edge outline only (no wireframe face diagonals).
 * @param {{
 *   bounds: { center: [number, number, number], size: [number, number, number] },
 *   selected: boolean,
 *   onClick: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void,
 * }} props
 */
function GroupSelectionOutline({ bounds, selected, onClick }) {
  const vpTheme = useViewportTheme();
  const edgeGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(bounds.size[0], bounds.size[1], bounds.size[2]);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [bounds.size[0], bounds.size[1], bounds.size[2]]);

  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry]);

  const edgeColor = selected ? vpTheme.axisAccent : vpTheme.selection.edgeIdle;

  return (
    <group position={bounds.center}>
      <mesh onClick={onClick}>
        <boxGeometry args={bounds.size} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <lineSegments geometry={edgeGeometry} raycast={() => null}>
        <lineBasicMaterial
          color={edgeColor}
          transparent
          opacity={selected ? 0.95 : 0.5}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  );
}

/**
 * @param {{
 *   object: import('../../store/editorStore.js').SceneObject,
 *   viewId: import('./viewportConfig.js').ViewportId,
 *   enableGizmos?: boolean,
 *   flatLit?: boolean,
 *   renderMode?: import('../../store/editorStore.js').RenderMode,
 *   childrenByParent: Map<string | '__root__', import('../../store/editorStore.js').SceneObject[]>,
 *   sceneObjects: import('../../store/editorStore.js').SceneObject[],
 * }} props
 */
export function SceneObject({
  object,
  viewId,
  enableGizmos = true,
  flatLit = false,
  renderMode = 'textured',
  childrenByParent,
  sceneObjects,
}) {
  const childObjects = childrenByParent.get(object.id) ?? [];
  const childKey = childObjects.map((c) => c.id).join(',');
  const { camera, gl, invalidate } = useThree();
  const groupRef = useRef(/** @type {THREE.Group | null} */ (null));
  const objectDragRef = useRef(null);
  const skipClickSelectRef = useRef(false);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selected = useEditorStore((s) => isObjectSelected(s, object.id));
  const editMode = useEditorStore((s) => s.editMode);
  const transformMode = useEditorStore((s) => s.transformMode);
  const selectedVertices = useEditorStore((s) => s.selectedVertices);
  const selectedEdges = useEditorStore((s) => s.selectedEdges);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const interactiveMeshTick = useEditorStore((s) => s.interactiveMeshTick);
  const showWireframe = useEditorStore((s) => s.showWireframe);
  const showNormals = useEditorStore((s) => s.showNormals);
  const showXRay = useEditorStore((s) => s.showXRay);
  const selectObject = useEditorStore((s) => s.selectObject);
  const updateObject = useEditorStore((s) => s.updateObject);
  const polyDrawActive = useEditorStore((s) => s.polyDrawActive);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const interactiveTransformActive = useEditorStore((s) => s.interactiveTransformActive);
  const paintModeActive = useEditorStore((s) => s.pixelEditorOpen && s.pixelPaintOnModel);
  const isGroup = object.isGroup || !object.mesh;
  const objectLocked = !!object.locked;

  const groupBounds = useMemo(() => {
    if (!isGroup) return null;
    return computeGroupLocalBounds(sceneObjects, object, childObjects);
  }, [isGroup, sceneObjects, object, childKey, childObjects]);

  const geometry = useDisposableMeshGeometry(object);
  const outlineGeometry = useDisposableMeshOutlineGeometry(object);
  const hasLiveModifiers = !!(object.meshModifiers?.mirrorEnabled || object.meshModifiers?.subdivisionLevel);
  const displayMesh = useMemo(
    () => evaluateObjectMesh(object),
    [object.mesh, object.meshModifiers, meshRevision, hasLiveModifiers ? interactiveMeshTick : 0],
  );
  const textureRef = useRef(/** @type {THREE.Texture | null} */ (null));
  const [texture, setTexture] = useState(/** @type {THREE.Texture | null} */ (null));
  const lastPaintUvRef = useRef(null);

  const replaceTexture = (nextTexture) => {
    if (textureRef.current !== nextTexture) {
      textureRef.current?.dispose();
      textureRef.current = nextTexture;
    }
    setTexture(nextTexture);
    invalidate();
  };

  const refreshLiveTexture = () => {
    const liveCanvas = getLiveTextureCanvas(object.id);
    if (!liveCanvas) return;
    const existing = textureRef.current;
    if (existing?.image === liveCanvas) {
      existing.needsUpdate = true;
      invalidate();
      return;
    }
    replaceTexture(configureTexture(new THREE.CanvasTexture(liveCanvas)));
  };

  useEffect(() => {
    let cancelled = false;
    const liveCanvas = getLiveTextureCanvas(object.id);
    if (liveCanvas) {
      const existing = textureRef.current;
      if (existing?.image === liveCanvas) {
        existing.needsUpdate = true;
        setTexture(existing);
        invalidate();
      } else {
        replaceTexture(configureTexture(new THREE.CanvasTexture(liveCanvas)));
      }
      return () => {
        cancelled = true;
      };
    }
    if (!object.textureDataUrl) {
      replaceTexture(null);
      return () => {
        cancelled = true;
      };
    }
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      replaceTexture(configureTexture(new THREE.Texture(img)));
    };
    img.src = object.textureDataUrl;
    return () => {
      cancelled = true;
    };
  }, [object.id, object.textureDataUrl, object.textureRevision, invalidate]);
  const hasTexture = !!texture;
  const texturedView = renderMode === 'textured' && hasTexture && !flatLit;
  const solidOnly = renderMode === 'solid';
  const wireMode = renderMode === 'wireframe';
  const outlineMode = renderMode === 'outline';

  useEffect(
    () => () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!groupRef.current) return;
    syncObjectTransform(groupRef.current, object);
  }, [object.id, object.position, object.rotation, object.scale]);

  const rayToPlane = (clientX, clientY, plane, out) => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, camera);
    return !!_raycaster.ray.intersectPlane(plane, out);
  };

  const pickObjectFromViewport = (e) => {
    const st = useEditorStore.getState();
    if (!canViewportPickObject(st)) return;

    const mode = selectModeFromEvent(e);
    e.nativeEvent.__khedObjectHit = true;
    e.stopPropagation();

    if (st.editMode !== 'object') {
      if (st.selectedId === object.id) return;
      if (mode === 'replace') selectObject(object.id, { preserveEditMode: true });
      else if (mode === 'add') selectObject(object.id, { additive: true, preserveEditMode: true });
      else selectObject(object.id, { remove: true, preserveEditMode: true });
      return;
    }

    if (mode === 'replace') selectObject(object.id);
    else if (mode === 'add') selectObject(object.id, { additive: true });
    else selectObject(object.id, { remove: true });
  };

  const beginObjectDrag = (e) => {
    if (e.nativeEvent.__khedViewportBodyDrag) {
      e.stopPropagation();
      return;
    }

    let st = useEditorStore.getState();
    if (
      e.button !== 0 ||
      st.gizmoInteracting ||
      (st.vertexManipActive && st.vertexManipSession) ||
      st.pendingPrimitive ||
      st.extrudeActive ||
      st.knifeActive ||
      st.interactiveTransformActive
    ) {
      return;
    }

    if (st.editMode !== 'object' || st.polyDrawActive || st.extrudeActive || st.knifeActive) {
      return;
    }

    e.nativeEvent.__khedObjectHit = true;
    if (objectLocked || st.transformMode !== 'translate') {
      return;
    }

    camera.getWorldDirection(_cameraDir);
    if (groupRef.current) {
      groupRef.current.getWorldPosition(_startPos);
    } else {
      _startPos.fromArray(object.position);
    }
    _dragPlane.setFromNormalAndCoplanarPoint(_cameraDir, _startPos);
    if (!rayToPlane(e.nativeEvent.clientX, e.nativeEvent.clientY, _dragPlane, _startHit)) {
      return;
    }

    const pointerId = e.pointerId;
    const downX = e.nativeEvent.clientX;
    const downY = e.nativeEvent.clientY;
    const plane = _dragPlane.clone();
    const startHit = _startHit.clone();
    const startPos = _startPos.clone();

    // Defer arming so TransformControls pointer/mouse handlers can set gizmoInteracting first.
    requestAnimationFrame(() => {
      const live = useEditorStore.getState();
      if (live.gizmoInteracting || live.marqueeActive) return;
      if (live.editMode !== 'object' || live.transformMode !== 'translate') return;
      if (live.interactiveTransformActive || live.extrudeActive || live.knifeActive) return;

      objectDragRef.current = {
        pointerId,
        downX,
        downY,
        started: false,
        selectMode: selectModeFromEvent(e.nativeEvent),
        plane,
        startHit,
        startPos,
      };
    });
  };

  useEffect(() => {
    const onPointerMove = (event) => {
      const live = useEditorStore.getState();
      if (live.marqueeActive || live.gizmoInteracting) {
        objectDragRef.current = null;
        return;
      }

      const drag = objectDragRef.current;
      if (!drag) return;

      const dx = event.clientX - drag.downX;
      const dy = event.clientY - drag.downY;
      if (!drag.started && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;

      if (!drag.started) {
        drag.started = true;
        let state = useEditorStore.getState();
        if (!isObjectSelected(state, object.id)) {
          const mode = drag.selectMode ?? 'replace';
          if (mode === 'replace') selectObject(object.id);
          else if (mode === 'add') selectObject(object.id, { additive: true });
          else selectObject(object.id, { remove: true });
          state = useEditorStore.getState();
        }
        state.pushHistory();
        const ids = resolveInteractiveObjectIds(state.objects, coalesceSelectedIds(state));
        /** @type {Record<string, [number, number, number]>} */
        const startWorld = {};
        for (const id of ids) {
          const obj = state.objects.find((o) => o.id === id);
          if (!obj) continue;
          const wm = getObjectWorldMatrix(state.objects, obj);
          wm.decompose(_startPos, _dragQuat, _dragScale);
          startWorld[id] = [_startPos.x, _startPos.y, _startPos.z];
        }
        drag.selectedIds = ids;
        drag.startWorld = startWorld;
      }

      if (!rayToPlane(event.clientX, event.clientY, drag.plane, _hit)) return;
      const delta = _hit.clone().sub(drag.startHit);
      const state = useEditorStore.getState();
      const grid = objectSnapGrid(state.snapGrid, state.gridSize);
      const ids = drag.selectedIds ?? [object.id];
      const startWorld = drag.startWorld ?? {};

      for (const id of ids) {
        const start = startWorld[id];
        if (!start) continue;
        let wx = start[0] + delta.x;
        let wy = start[1] + delta.y;
        let wz = start[2] + delta.z;
        const worldPos =
          grid > 0 ? snapVector3Components(wx, wy, wz, grid) : [wx, wy, wz];
        const target = state.objects.find((o) => o.id === id);
        if (!target) continue;
        const position = worldPositionToObjectLocal(worldPos, state.objects, target);
        state.updateObject(id, { position }, { skipHistory: true });
      }

      if (groupRef.current && ids.includes(object.id)) {
        const self = useEditorStore.getState().objects.find((o) => o.id === object.id);
        if (self) groupRef.current.position.fromArray(self.position);
      }
      state.setStatus(ids.length > 1 ? 'Moving selection' : 'Moving object');
    };

    const onPointerUp = () => {
      const live = useEditorStore.getState();
      if (live.marqueeActive || live.gizmoInteracting) {
        objectDragRef.current = null;
        return;
      }

      const drag = objectDragRef.current;
      if (drag?.started) {
        skipClickSelectRef.current = true;
        const count = drag.selectedIds?.length ?? 1;
        useEditorStore.getState().setStatus(count > 1 ? 'Selection moved' : 'Object moved');
      }
      objectDragRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };
  }, [camera, gl, object.id, object.position, selectObject, updateObject]);

  const edgeMoveVertices = useMemo(
    () => (object.mesh ? verticesFromEdgeKeys(selectedEdges) : []),
    [object.mesh, selectedEdges, meshRevision],
  );

  const faceMoveVertices = useMemo(
    () => (object.mesh ? verticesFromFaceIndices(object.mesh, selectedFaces) : []),
    [object.mesh, selectedFaces, meshRevision],
  );

  const moveVertexIndices =
    editMode === 'vertex'
      ? selectedVertices
      : editMode === 'edge'
        ? edgeMoveVertices
        : editMode === 'face'
          ? faceMoveVertices
          : [];

  const showSubObjectGizmo =
    enableGizmos &&
    selected &&
    (editMode === 'vertex' || editMode === 'edge' || editMode === 'face') &&
    moveVertexIndices.length > 0 &&
    !polyDrawActive &&
    !extrudeActive &&
    !knifeActive &&
    !interactiveTransformActive &&
    !isGroup &&
    !objectLocked;

  const paint3DActive = (() => {
    if (!paintModeActive || !hasTexture) return false;
    const tool = useEditorStore.getState().pixelTool;
    return tool === 'brush' || tool === 'pencil' || tool === 'eraser' || tool === 'fill';
  })();
  const meshXRay = showXRay && !paint3DActive && !wireMode;
  const xrayOpacity = selected ? 0.72 : 0.42;
  const meshMaterialProps = meshXRay
    ? { transparent: true, opacity: xrayOpacity, depthWrite: false }
    : { transparent: false, opacity: 1, depthWrite: true };
  const textureAlphaProps = texture
    ? { transparent: true, alphaTest: 0.001 }
    : { transparent: meshMaterialProps.transparent, alphaTest: 0 };

  const drawQuadOutline =
    outlineGeometry &&
    (wireMode || ((showWireframe || outlineMode) && editMode !== 'face'));

  const paintAtIntersection = (e) => {
    const uv = e.uv;
    if (!uv || !object.id) return;
    const st = useEditorStore.getState();
    if (st.selectedId !== object.id) st.selectObject(object.id);
    st.setPixelPaintTargetId(object.id);
    st.paintObjectTextureAtUv(object.id, uv.x, uv.y, {
      color: st.pixelColor,
      brushSize: st.pixelBrushSize,
      erase: st.pixelTool === 'eraser',
      pixelPerfect: st.pixelTool === 'pencil',
      opacity: st.pixelOpacity,
    });
    refreshLiveTexture();
    lastPaintUvRef.current = { x: uv.x, y: uv.y };
  };

  const paintStrokeToIntersection = (e) => {
    const uv = e.uv;
    if (!uv || !object.id) return;
    const st = useEditorStore.getState();
    if (st.selectedId !== object.id) st.selectObject(object.id);
    st.setPixelPaintTargetId(object.id);
    const options = {
      color: st.pixelColor,
      brushSize: st.pixelBrushSize,
      erase: st.pixelTool === 'eraser',
      pixelPerfect: st.pixelTool === 'pencil',
      opacity: st.pixelOpacity,
    };
    const last = lastPaintUvRef.current;
    if (last) {
      st.paintObjectTextureStroke(object.id, last.x, last.y, uv.x, uv.y, options);
    } else {
      st.paintObjectTextureAtUv(object.id, uv.x, uv.y, options);
    }
    refreshLiveTexture();
    lastPaintUvRef.current = { x: uv.x, y: uv.y };
  };

  const content = (
    <group ref={groupRef} visible={object.visible}>
      {!isGroup && geometry && (
        <>
          <mesh
            geometry={geometry}
            onPointerMove={(e) => {
              if (!paint3DActive) return;
              if (useEditorStore.getState().pixelTool === 'fill') return;
              if ((e.buttons & 1) !== 1) return;
              e.stopPropagation();
              paintStrokeToIntersection(e);
            }}
            onPointerDown={(e) => {
              const st = useEditorStore.getState();
              if (
                e.button === 0 &&
                st.editMode !== 'object' &&
                st.selectedId === object.id &&
                !paint3DActive
              ) {
                return;
              }
              e.nativeEvent.__khedObjectHit = true;
              if (paint3DActive && e.button === 0) {
                e.stopPropagation();
                lastPaintUvRef.current = null;
                const st = useEditorStore.getState();
                st.pushHistory();
                if (st.selectedId !== object.id) st.selectObject(object.id);
                st.setPixelPaintTargetId(object.id);
                if (st.pixelTool === 'fill') {
                  const fi = triangleToFaceIndex(object.mesh, e.faceIndex ?? -1);
                  if (fi >= 0) {
                    st.paintObjectTextureFace(object.id, fi, {
                      color: st.pixelColor,
                      erase: false,
                      opacity: st.pixelOpacity,
                    });
                    refreshLiveTexture();
                  }
                  return;
                }
                paintAtIntersection(e);
                return;
              }
              beginObjectDrag(e);
            }}
            onPointerUp={() => {
              if (paint3DActive) lastPaintUvRef.current = null;
            }}
            onPointerCancel={() => {
              if (paint3DActive) lastPaintUvRef.current = null;
            }}
            onClick={(e) => {
              if (paint3DActive) return;
              if (skipClickSelectRef.current) {
                skipClickSelectRef.current = false;
                return;
              }
              const st = useEditorStore.getState();
              if (st.editMode !== 'object' && st.selectedId === object.id) return;
              pickObjectFromViewport(e);
            }}
            castShadow
            receiveShadow
          >
            {wireMode ? (
              <meshBasicMaterial visible={false} />
            ) : texturedView ? (
              <meshBasicMaterial
                map={texture}
                side={THREE.DoubleSide}
                toneMapped={false}
                transparent={textureAlphaProps.transparent}
                opacity={meshMaterialProps.opacity}
                depthWrite={meshMaterialProps.depthWrite}
                alphaTest={textureAlphaProps.alphaTest}
              />
            ) : flatLit ? (
              <meshBasicMaterial
                map={solidOnly || !hasTexture ? undefined : texture}
                vertexColors={!hasTexture}
                flatShading
                side={THREE.DoubleSide}
                transparent={textureAlphaProps.transparent}
                opacity={meshMaterialProps.opacity}
                depthWrite={meshMaterialProps.depthWrite}
                alphaTest={textureAlphaProps.alphaTest}
              />
            ) : (
              <meshStandardMaterial
                map={solidOnly ? undefined : texture ?? undefined}
                vertexColors={!hasTexture}
                roughness={0.85}
                metalness={0.02}
                flatShading={!hasTexture}
                side={THREE.DoubleSide}
                transparent={textureAlphaProps.transparent}
                opacity={meshMaterialProps.opacity}
                depthWrite={meshMaterialProps.depthWrite}
                alphaTest={textureAlphaProps.alphaTest}
              />
            )}
          </mesh>
          {drawQuadOutline && (
            <lineSegments geometry={outlineGeometry} renderOrder={outlineMode ? 2 : 1}>
              <lineBasicMaterial
                color={
                  outlineMode ? '#0f1725' : wireMode ? (selected ? '#eaf3ff' : '#dce7f8') : '#1a2030'
                }
                transparent
                opacity={outlineMode ? 0.75 : wireMode ? 0.92 : 0.35}
                depthTest={outlineMode ? false : !meshXRay}
                toneMapped={false}
              />
            </lineSegments>
          )}
          {showNormals && <FaceNormalsOverlay mesh={displayMesh} selected={selected} />}
        </>
      )}

      {isGroup && groupBounds && (
        <GroupSelectionOutline
          bounds={groupBounds}
          selected={selected}
          onClick={(e) => {
            if (paint3DActive) return;
            if (skipClickSelectRef.current) {
              skipClickSelectRef.current = false;
              return;
            }
            pickObjectFromViewport(e);
          }}
        />
      )}

      {childObjects.map((child) => (
        <SceneObject
          key={child.id}
          object={child}
          viewId={viewId}
          enableGizmos={enableGizmos}
          flatLit={flatLit}
          renderMode={renderMode}
          childrenByParent={childrenByParent}
          sceneObjects={sceneObjects}
        />
      ))}

      {selected && editMode !== 'object' && !polyDrawActive && !extrudeActive && !knifeActive && !isGroup && (
        <SubObjectOverlay object={object} viewId={viewId} />
      )}

    </group>
  );

  const subObjectGizmo = showSubObjectGizmo && object.mesh && (
    <VertexTransformControls
      objectId={object.id}
      mesh={object.mesh}
      objectGroupRef={groupRef}
      moveVertexIndices={moveVertexIndices}
    />
  );

  return (
    <>
      {content}
      {subObjectGizmo}
    </>
  );
}
