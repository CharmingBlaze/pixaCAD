import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  CircleDot,
  Download,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  ImagePlus,
  Maximize2,
  MousePointer2,
  Paintbrush,
  RotateCw,
  Save,
  ScanLine,
  Trash2,
  UnfoldVertical,
  X,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore.js';
import { applyListSelection, selectModeFromEvent } from '../../store/selection.js';
import { dataUrlToBlob, saveBlob, safeName } from '../../export/fileSave.js';
import { useUvEditorTheme } from '../../hooks/useUvEditorTheme.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { buildMeshOutlineGeometry } from '../../lib/mesh/faceGeometry.js';
import { seamAwareUnwrap } from '../../lib/mesh/uvSeamUnwrap.js';

const CHECKER = 24;
const POINT_PICK_PX = 16;
const UV_MARQUEE_DRAG_PX = 5;
const UV_BASE_SIZE = 0.74;
const ATLAS_PADDING = 0.018;
const DEFAULT_TEXTURE_SIZE = 512;
const DEFAULT_TEXTURE_BACKGROUND = '#ffffff';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function polygonCenter(points) {
  const c = [0, 0];
  if (points.length === 0) return [0.5, 0.5];
  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
  }
  return [c[0] / points.length, c[1] / points.length];
}

function selectionBounds(points) {
  if (!points.length) {
    return { minU: 0.5, maxU: 0.5, minV: 0.5, maxV: 0.5, centerU: 0.5, centerV: 0.5 };
  }
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const [u, v] of points) {
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  return {
    minU,
    maxU,
    minV,
    maxV,
    centerU: (minU + maxU) / 2,
    centerV: (minV + maxV) / 2,
  };
}

function safeScale(numerator, denominator) {
  if (Math.abs(denominator) < 1e-6) return 1;
  return numerator / denominator;
}

function scaledPosition(mesh, vertexIndex, objectScale = [1, 1, 1]) {
  const p = mesh.getPosition(vertexIndex);
  return [
    p[0] * (objectScale[0] ?? 1),
    p[1] * (objectScale[1] ?? 1),
    p[2] * (objectScale[2] ?? 1),
  ];
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function boundsOverlap(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function uvPointKey(faceIndex, uvIndex) {
  return `${faceIndex}:${uvIndex}`;
}

function getImageFileFromDataTransfer(dataTransfer) {
  if (!dataTransfer) return null;
  const files = Array.from(dataTransfer.files ?? []);
  return files.find((f) => f.type?.startsWith('image/')) ?? null;
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 0.000001) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function makeUvMap(mesh, updates = {}) {
  const out = {};
  if (!mesh) return out;
  for (let i = 0; i < mesh.faceCount; i++) {
    out[i] = updates[i] ?? mesh.faceUVs[i] ?? mesh.createDefaultFaceUVs(mesh.faces[i], i);
  }
  return out;
}

function getUvCanvasView(canvas, uvView, image = null) {
  const width = canvas?.width ?? 1;
  const height = canvas?.height ?? 1;
  const size = Math.min(width, height) * UV_BASE_SIZE * uvView.zoom;
  const imageWidth = image?.naturalWidth || image?.width || 0;
  const imageHeight = image?.naturalHeight || image?.height || 0;
  const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
  const uvWidth = aspect >= 1 ? size : size * aspect;
  const uvHeight = aspect >= 1 ? size / aspect : size;
  return {
    width,
    height,
    size,
    uvWidth,
    uvHeight,
    left: (width - uvWidth) / 2 + uvView.panX,
    top: (height - uvHeight) / 2 + uvView.panY,
  };
}

function triangleFaceMap(mesh) {
  const map = [];
  if (!mesh) return map;
  for (let fi = 0; fi < mesh.faceCount; fi++) {
    const face = mesh.faces[fi];
    for (let i = 1; i < face.length - 1; i++) map.push(fi);
  }
  return map;
}

function unwrapFace(mesh, faceIndex, mode, objectScale = [1, 1, 1]) {
  const face = mesh.faces[faceIndex];
  if (!face) return [];
  if (mode === 'atlas') return mesh.createDefaultFaceUVs(face, faceIndex);

  if (mode === 'fill') {
    if (face.length === 3) return [[0.08, 0.08], [0.92, 0.08], [0.5, 0.92]];
    return face.map((_, i) => {
      const a = (i / face.length) * Math.PI * 2 - Math.PI / 4;
      return [0.5 + Math.cos(a) * 0.42, 0.5 + Math.sin(a) * 0.42];
    });
  }

  const normal = mesh.getFaceNormal(faceIndex);
  const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const dropAxis = abs.indexOf(Math.max(...abs));
  const projected = face.map((vi) => {
    const p = scaledPosition(mesh, vi, objectScale);
    if (mode === 'front') return [p[0], p[1]];
    if (mode === 'side') return [p[2], p[1]];
    if (mode === 'top') return [p[0], p[2]];
    if (dropAxis === 0) return [p[2], p[1]];
    if (dropAxis === 1) return [p[0], p[2]];
    return [p[0], p[1]];
  });
  const minX = Math.min(...projected.map((p) => p[0]));
  const maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1]));
  const maxY = Math.max(...projected.map((p) => p[1]));
  const w = Math.max(maxX - minX, 0.0001);
  const h = Math.max(maxY - minY, 0.0001);
  const scale = 0.84 / Math.max(w, h);
  const usedW = w * scale;
  const usedH = h * scale;
  return projected.map(([x, y]) => [
    0.5 - usedW / 2 + (x - minX) * scale,
    0.5 - usedH / 2 + (y - minY) * scale,
  ]);
}

function projectFaceToIsland(mesh, faceIndex, objectScale = [1, 1, 1]) {
  const face = mesh.faces[faceIndex];
  const normal = mesh.getFaceNormal(faceIndex);
  const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const dropAxis = abs.indexOf(Math.max(...abs));
  const projected = face.map((vi) => {
    const p = scaledPosition(mesh, vi, objectScale);
    if (dropAxis === 0) return [p[2], p[1]];
    if (dropAxis === 1) return [p[0], p[2]];
    return [p[0], p[1]];
  });
  const minX = Math.min(...projected.map((p) => p[0]));
  const maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1]));
  const maxY = Math.max(...projected.map((p) => p[1]));
  const width = Math.max(maxX - minX, 0.0001);
  const height = Math.max(maxY - minY, 0.0001);
  return {
    faceIndex,
    width,
    height,
    points: projected.map(([x, y]) => [(x - minX) / width, (y - minY) / height]),
  };
}

function smartAtlasUnwrap(mesh, faceIndices, objectScale = [1, 1, 1], padding = ATLAS_PADDING) {
  const islands = faceIndices
    .filter((fi) => mesh.faces[fi])
    .map((fi) => projectFaceToIsland(mesh, fi, objectScale));
  if (islands.length === 0) return {};

  const totalArea = islands.reduce((sum, island) => sum + island.width * island.height, 0);
  const targetRowWidth = Math.sqrt(totalArea) * 1.15;
  const sorted = [...islands].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
  const placements = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let atlasWidth = 0;
  let atlasHeight = 0;

  for (const island of sorted) {
    if (cursorX > 0 && cursorX + island.width > targetRowWidth) {
      cursorX = 0;
      cursorY += rowHeight + padding;
      rowHeight = 0;
    }
    placements.push({ ...island, x: cursorX, y: cursorY });
    cursorX += island.width + padding;
    rowHeight = Math.max(rowHeight, island.height);
    atlasWidth = Math.max(atlasWidth, cursorX);
    atlasHeight = Math.max(atlasHeight, cursorY + rowHeight);
  }

  const scale = (1 - padding * 2) / Math.max(atlasWidth, atlasHeight, 0.0001);
  const offsetX = (1 - atlasWidth * scale) / 2;
  const offsetY = (1 - atlasHeight * scale) / 2;
  const next = {};
  for (const island of placements) {
    next[island.faceIndex] = island.points.map(([u, v]) => [
      clamp01(offsetX + (island.x + u * island.width) * scale),
      clamp01(offsetY + (island.y + v * island.height) * scale),
    ]);
  }
  return next;
}

function selectedFaceGeometry(mesh, selectedFaces) {
  if (!mesh || selectedFaces.length === 0) return null;
  const positions = [];
  for (const fi of selectedFaces) {
    const face = mesh.faces[fi];
    if (!face) continue;
    for (let i = 1; i < face.length - 1; i++) {
      for (const vi of [face[0], face[i], face[i + 1]]) {
        positions.push(...mesh.getPosition(vi));
      }
    }
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function UVPreview3DScene({
  object,
  geometry,
  outlineGeometry,
  triToFace,
  selectedGeometry,
  showWire,
  meshRevision,
  previewTransform,
  onSelectFace,
}) {
  const { invalidate } = useThree();
  const vpTheme = useViewportTheme();
  const textureRef = useRef(/** @type {THREE.Texture | null} */ (null));
  const [textureMap, setTextureMap] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let nextTexture = null;

    if (!object.textureDataUrl) {
      textureRef.current?.dispose();
      textureRef.current = null;
      setTextureMap(null);
      invalidate();
      return () => {
        cancelled = true;
      };
    }

    const applyImage = (img) => {
      if (cancelled || !img.naturalWidth || !img.naturalHeight) return;
      nextTexture = new THREE.Texture(img);
      nextTexture.colorSpace = THREE.SRGBColorSpace;
      nextTexture.wrapS = THREE.ClampToEdgeWrapping;
      nextTexture.wrapT = THREE.ClampToEdgeWrapping;
      nextTexture.needsUpdate = true;
      textureRef.current?.dispose();
      textureRef.current = nextTexture;
      setTextureMap(nextTexture);
      invalidate();
    };

    const img = new Image();
    img.onload = () => applyImage(img);
    img.onerror = () => {
      if (!cancelled) setTextureMap(null);
    };
    img.src = object.textureDataUrl;
    if (img.complete && img.naturalWidth) applyImage(img);

    return () => {
      cancelled = true;
      if (nextTexture && textureRef.current !== nextTexture) nextTexture.dispose();
    };
  }, [object.textureDataUrl, invalidate]);

  useEffect(() => {
    invalidate();
  }, [geometry, meshRevision, invalidate]);

  useEffect(
    () => () => {
      textureRef.current?.dispose();
      textureRef.current = null;
    },
    [],
  );

  return (
    <>
      <color attach="background" args={[vpTheme.background]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[4, 5, 3]} intensity={0.9} />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />
      <group rotation={object.rotation} scale={previewTransform.scale} position={previewTransform.position}>
        <mesh
          geometry={geometry}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            const faceIndex = triToFace[e.faceIndex ?? -1];
            if (faceIndex === undefined) return;
            e.stopPropagation();
            onSelectFace(faceIndex, e.nativeEvent ?? e);
          }}
        >
          <meshBasicMaterial
            key={textureMap ? object.textureDataUrl : 'no-texture'}
            map={textureMap ?? undefined}
            vertexColors={!textureMap}
            toneMapped={false}
            transparent={!!textureMap}
            alphaTest={textureMap ? 0.001 : 0}
            depthWrite={!textureMap}
            flatShading
            side={THREE.DoubleSide}
          />
        </mesh>
        {showWire && outlineGeometry && (
          <lineSegments geometry={outlineGeometry} raycast={() => null}>
            <lineBasicMaterial
              color={vpTheme.axisPrimary}
              transparent
              opacity={0.62}
              toneMapped={false}
            />
          </lineSegments>
        )}
        {selectedGeometry && (
          <mesh geometry={selectedGeometry} renderOrder={20} raycast={() => null}>
            <meshBasicMaterial
              color={vpTheme.selection.faceFill}
              transparent
              opacity={0.58}
              depthTest={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}
      </group>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        mouseButtons={{
          LEFT: null,
          MIDDLE: THREE.MOUSE.PAN,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
      />
    </>
  );
}

function UVPreview3D({ object, selectedFaces, showWire, meshRevision, onSelectFace, onClearSelection }) {
  const mesh = object?.mesh;
  const geometry = useMemo(() => mesh?.toBufferGeometry() ?? null, [mesh, meshRevision]);
  const outlineGeometry = useMemo(
    () => (mesh ? buildMeshOutlineGeometry(mesh) : null),
    [mesh, meshRevision],
  );
  const triToFace = useMemo(() => triangleFaceMap(mesh), [mesh, meshRevision]);
  const selectedGeometry = useMemo(
    () => selectedFaceGeometry(mesh, selectedFaces),
    [mesh, selectedFaces, meshRevision],
  );
  const previewTransform = useMemo(() => {
    if (!geometry || !object) return { position: [0, 0, 0], scale: [1, 1, 1] };
    geometry.computeBoundingSphere();
    const sphere = geometry.boundingSphere;
    const center = sphere?.center ?? new THREE.Vector3();
    const radius = Math.max(sphere?.radius ?? 1, 0.001);
    const maxObjectScale = Math.max(...object.scale.map((v) => Math.abs(v)), 0.001);
    const fit = 1.15 / (radius * maxObjectScale);
    return {
      position: [-center.x, -center.y, -center.z],
      scale: object.scale.map((v) => v * fit),
    };
  }, [geometry, object]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => outlineGeometry?.dispose(), [outlineGeometry]);
  useEffect(() => () => selectedGeometry?.dispose(), [selectedGeometry]);

  if (!object || !mesh || !geometry) {
    return <div className="uvPreviewEmpty">Select a mesh object to preview UVs.</div>;
  }

  return (
    <Canvas
      className="uvPreviewCanvas"
      camera={{ position: [2.4, 1.8, 2.6], fov: 42 }}
      onPointerMissed={(e) => {
        if (e.button !== 0) return;
        onClearSelection();
      }}
    >
      <UVPreview3DScene
        object={object}
        geometry={geometry}
        outlineGeometry={outlineGeometry}
        triToFace={triToFace}
        selectedGeometry={selectedGeometry}
        showWire={showWire}
        meshRevision={meshRevision}
        previewTransform={previewTransform}
        onSelectFace={onSelectFace}
      />
    </Canvas>
  );
}

export function UVEditorWindow() {
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const menubarRef = useRef(null);
  const dragRef = useRef(null);
  const pendingUvCommitRef = useRef({});
  const windowDragRef = useRef(null);
  const themeColorsRef = useRef(/** @type {ReturnType<typeof useUvEditorTheme> | null} */ (null));
  const uvEditorOpen = useEditorStore((s) => s.uvEditorOpen);
  const uvTheme = useUvEditorTheme();
  const closeUvEditor = useEditorStore((s) => s.closeUvEditor);
  const selectedId = useEditorStore((s) => s.selectedId);
  const objects = useEditorStore((s) => s.objects);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const selectFace = useEditorStore((s) => s.selectFace);
  const clearSubSelection = useEditorStore((s) => s.clearSubSelection);
  const setEditMode = useEditorStore((s) => s.setEditMode);
  const updateFaceUVs = useEditorStore((s) => s.updateFaceUVs);
  const setObjectTexture = useEditorStore((s) => s.setObjectTexture);
  const setObjectImageTextureLayer = useEditorStore((s) => s.setObjectImageTextureLayer);
  const openPixelEditor = useEditorStore((s) => s.openPixelEditor);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const object = objects.find((o) => o.id === selectedId);
  const mesh = object?.mesh;
  const [localSelection, setLocalSelection] = useState([]);
  const [image, setImage] = useState(null);
  const [draftUVs, setDraftUVs] = useState({});
  const draftUVsRef = useRef(draftUVs);
  useEffect(() => {
    draftUVsRef.current = draftUVs;
  }, [draftUVs]);
  const [tool, setTool] = useState('select');
  const [unwrapMode, setUnwrapMode] = useState('smart');
  const [atlasPadding, setAtlasPadding] = useState(0.02);
  const [selectedUvPoints, setSelectedUvPoints] = useState([]);
  const [showWire, setShowWire] = useState(true);
  const [imageLayerView, setImageLayerView] = useState('texture-uv');
  const [snap, setSnap] = useState(false);
  const [uvMarquee, setUvMarquee] = useState(null);
  const [dragImageOver, setDragImageOver] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 18, y: 28 });
  const [uvView, setUvView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [uvMenuOpen, setUvMenuOpen] = useState(null);

  const getSelectionHandlePoints = (canvas) => {
    if (!mesh || localSelection.length === 0) return null;
    const selectedPoints = localSelection.flatMap((fi) => uvMap[fi] ?? []);
    if (selectedPoints.length === 0) return null;
    const bounds = selectionBounds(selectedPoints);
    const { uvWidth, uvHeight, left, top } = getUvCanvasView(canvas, uvView, image);
    const sx = (u) => left + u * uvWidth;
    const sy = (v) => top + (1 - v) * uvHeight;
    const rotOffsetPx = 22;
    return {
      bounds,
      points: {
        nw: { x: sx(bounds.minU), y: sy(bounds.maxV) },
        n: { x: sx(bounds.centerU), y: sy(bounds.maxV) },
        ne: { x: sx(bounds.maxU), y: sy(bounds.maxV) },
        e: { x: sx(bounds.maxU), y: sy(bounds.centerV) },
        se: { x: sx(bounds.maxU), y: sy(bounds.minV) },
        s: { x: sx(bounds.centerU), y: sy(bounds.minV) },
        sw: { x: sx(bounds.minU), y: sy(bounds.minV) },
        w: { x: sx(bounds.minU), y: sy(bounds.centerV) },
        rotate: { x: sx(bounds.centerU), y: sy(bounds.maxV) - rotOffsetPx },
      },
      box: {
        left: sx(bounds.minU),
        right: sx(bounds.maxU),
        top: sy(bounds.maxV),
        bottom: sy(bounds.minV),
      },
    };
  };

  useEffect(() => {
    if (!uvEditorOpen) return;
    setMinimized(false);
    const width = Math.min(1280, window.innerWidth - 36);
    const height = Math.min(820, window.innerHeight - 52);
    setWindowPos({
      x: Math.max(0, Math.min(window.innerWidth - width, 18)),
      y: Math.max(0, Math.min(window.innerHeight - height, 28)),
    });
  }, [uvEditorOpen]);

  useEffect(() => {
    if (!uvEditorOpen) return undefined;
    const clampWindowToViewport = () => {
      setWindowPos((current) => {
        const width = minimized ? 260 : Math.min(1280, window.innerWidth - 36);
        const height = minimized ? 24 : Math.min(820, window.innerHeight - 52);
        return {
          x: Math.max(0, Math.min(window.innerWidth - width, current.x)),
          y: Math.max(0, Math.min(window.innerHeight - height, current.y)),
        };
      });
    };
    window.addEventListener('resize', clampWindowToViewport);
    clampWindowToViewport();
    return () => window.removeEventListener('resize', clampWindowToViewport);
  }, [uvEditorOpen, minimized]);

  useEffect(() => {
    if (!uvEditorOpen) return;
    setEditMode('face');
  }, [uvEditorOpen, setEditMode]);

  useEffect(() => {
    if (!mesh) {
      setLocalSelection([]);
      setSelectedUvPoints([]);
      return;
    }
    const validFaces = selectedFaces.filter((fi) => Number.isInteger(fi) && fi >= 0 && fi < mesh.faceCount);
    setLocalSelection(validFaces);
  }, [selectedFaces, mesh]);

  useEffect(() => {
    setDraftUVs({});
    pendingUvCommitRef.current = {};
    setSelectedUvPoints([]);
    setUvMarquee(null);
    dragRef.current = null;
    setUvView({ zoom: 1, panX: 0, panY: 0 });
  }, [selectedId]);

  useEffect(() => {
    if (uvEditorOpen) return undefined;
    pendingUvCommitRef.current = {};
    dragRef.current = null;
    windowDragRef.current = null;
    setUvMarquee(null);
    setDragImageOver(false);
    setSelectedUvPoints([]);
    return undefined;
  }, [uvEditorOpen]);

  useEffect(() => {
    if (!object?.textureDataUrl) {
      setImage(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setImage(img);
    };
    img.onerror = () => {
      if (!cancelled) setImage(null);
    };
    img.src = object.textureDataUrl;
    if (img.complete && img.naturalWidth && !cancelled) setImage(img);
    return () => {
      cancelled = true;
    };
  }, [object?.textureDataUrl]);

  const uvMap = useMemo(() => makeUvMap(mesh, draftUVs), [mesh, draftUVs, meshRevision]);

  const getEffectiveUvMap = () =>
    makeUvMap(mesh, { ...draftUVsRef.current, ...pendingUvCommitRef.current });

  useEffect(() => {
    themeColorsRef.current = uvTheme;
  }, [uvTheme]);

  const draw = () => {
    const theme = themeColorsRef.current ?? uvTheme;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = Math.max(1, Math.floor(rect.width * dpr));
    const nextHeight = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
      canvas.width = nextWidth;
      canvas.height = nextHeight;
    }

    const { width, height, uvWidth, uvHeight, left, top } = getUvCanvasView(canvas, uvView, image);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.workspaceBg;
    ctx.fillRect(0, 0, width, height);

    for (let y = 0; y < uvHeight; y += CHECKER) {
      for (let x = 0; x < uvWidth; x += CHECKER) {
        ctx.fillStyle = ((x / CHECKER + y / CHECKER) % 2 === 0) ? theme.checkerA : theme.checkerB;
        ctx.fillRect(left + x, top + y, CHECKER, CHECKER);
      }
    }
    const showTextureLayer = imageLayerView === 'texture-uv' || imageLayerView === 'texture';
    const showUvLayer = imageLayerView === 'texture-uv' || imageLayerView === 'uv';
    if (image && showTextureLayer) ctx.drawImage(image, left, top, uvWidth, uvHeight);
    ctx.strokeStyle = theme.uvBounds;
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, uvWidth, uvHeight);

    if (!mesh || !showUvLayer) return;
    const effectiveUvMap = getEffectiveUvMap();
    const selectionSet = new Set(localSelection);
    const selectedPointSet = new Set(selectedUvPoints);
    for (let fi = 0; fi < mesh.faceCount; fi++) {
      const pts = (effectiveUvMap[fi] ?? []).map((uv) => [left + uv[0] * uvWidth, top + (1 - uv[1]) * uvHeight]);
      if (pts.length < 2) continue;
      const selected = selectionSet.has(fi);
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
      ctx.closePath();
      if (selected) {
        ctx.fillStyle = theme.faceSelectedFill;
        ctx.fill();
      }
      if (showWire || selected) {
        ctx.strokeStyle = selected ? theme.wireSelected : theme.wireIdle;
        ctx.lineWidth = selected ? 2 : 1;
        ctx.stroke();
      }
      if (selected) {
        ctx.fillStyle = theme.vertexSelected;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          const isSelectedPoint = selectedPointSet.has(uvPointKey(fi, i));
          ctx.beginPath();
          ctx.arc(p[0], p[1], isSelectedPoint ? 6 : 4, 0, Math.PI * 2);
          ctx.fill();
          if (isSelectedPoint) {
            ctx.strokeStyle = theme.vertexOutline;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    }

    if (uvMarquee) {
      const w = uvMarquee.right - uvMarquee.left;
      const h = uvMarquee.bottom - uvMarquee.top;
      ctx.save();
      ctx.fillStyle = uvMarquee.crossing ? theme.marqueeCrossFill : theme.marqueeFill;
      ctx.fillRect(uvMarquee.left, uvMarquee.top, w, h);
      ctx.strokeStyle = uvMarquee.crossing ? theme.marqueeCrossStroke : theme.marqueeStroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash(uvMarquee.crossing ? [3, 3] : [7, 5]);
      ctx.strokeRect(uvMarquee.left, uvMarquee.top, w, h);
      ctx.restore();
    }

    const handleData = tool === 'select' ? getSelectionHandlePoints(canvas) : null;
    if (!handleData) return;
    const { box, points } = handleData;
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

    ctx.strokeStyle = theme.handleBox;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.left, box.top, Math.max(1, box.right - box.left), Math.max(1, box.bottom - box.top));
    ctx.setLineDash([]);

    ctx.strokeStyle = theme.handleLine;
    ctx.beginPath();
    ctx.moveTo(points.n.x, points.n.y);
    ctx.lineTo(points.rotate.x, points.rotate.y);
    ctx.stroke();

    for (const key of handles) {
      const p = points[key];
      ctx.fillStyle = theme.handleFill;
      ctx.strokeStyle = theme.handleStroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = theme.handleFill;
    ctx.strokeStyle = theme.handleStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(points.rotate.x, points.rotate.y, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };

  const beginWindowDrag = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    windowDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: windowPos.x,
      originY: windowPos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveWindowDrag = (e) => {
    const drag = windowDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const ownerWindow = e.currentTarget.ownerDocument.defaultView ?? window;
    const width = minimized ? 260 : Math.min(1280, ownerWindow.innerWidth - 36);
    const height = minimized ? 24 : Math.min(820, ownerWindow.innerHeight - 52);
    setWindowPos({
      x: Math.max(0, Math.min(ownerWindow.innerWidth - width, drag.originX + e.clientX - drag.startX)),
      y: Math.max(0, Math.min(ownerWindow.innerHeight - height, drag.originY + e.clientY - drag.startY)),
    });
  };

  const endWindowDrag = (e) => {
    if (windowDragRef.current?.pointerId === e.pointerId) {
      windowDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ok */
      }
    }
  };

  useEffect(() => {
    if (!uvEditorOpen) return undefined;
    draw();
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [uvEditorOpen, uvMap, uvView, localSelection, selectedUvPoints, image, imageLayerView, showWire, meshRevision, uvMarquee, uvTheme]);

  const copyUvUpdates = (updates) =>
    Object.fromEntries(
      Object.entries(updates).map(([faceIndex, uvs]) => [
        faceIndex,
        uvs.map(([u, v]) => [u, v]),
      ]),
    );

  const flushPendingUVs = ({ skipHistory = false } = {}) => {
    const pending = pendingUvCommitRef.current;
    if (!object || Object.keys(pending).length === 0) return;
    const cleanPending = copyUvUpdates(pending);
    setDraftUVs((current) => ({ ...current, ...cleanPending }));
    updateFaceUVs(object.id, cleanPending, { skipHistory });
    pendingUvCommitRef.current = {};
  };

  const commitUVs = (next, { persist = true, skipHistory = false } = {}) => {
    const cleanNext = copyUvUpdates(next);
    pendingUvCommitRef.current = { ...pendingUvCommitRef.current, ...cleanNext };
    if (persist) {
      setDraftUVs((current) => ({ ...current, ...cleanNext }));
      flushPendingUVs({ skipHistory });
    } else {
      draw();
    }
  };

  const closeUvEditorWithSave = () => {
    flushPendingUVs();
    closeUvEditor();
  };

  const applyUvFaceSelection = (faceIndices, mode, clearPoints = true) => {
    if (!mesh) return;
    const uniqueHits = [...new Set(faceIndices.filter((fi) => fi >= 0 && fi < mesh.faceCount))];
    const current = [...localSelection];
    let next = current;

    if (mode === 'replace') {
      next = uniqueHits;
    } else if (mode === 'add') {
      const set = new Set(current);
      uniqueHits.forEach((fi) => set.add(fi));
      next = [...set];
    } else if (mode === 'remove') {
      const remove = new Set(uniqueHits);
      next = current.filter((fi) => !remove.has(fi));
    }

    setLocalSelection(next);
    if (clearPoints) setSelectedUvPoints([]);

    if (next.length === 0) {
      clearSubSelection();
      return;
    }
    selectFace(next[0], 'replace');
    for (const fi of next.slice(1)) selectFace(fi, 'add');
  };

  const applyUvPointSelection = (pointHits, mode) => {
    const keys = [...new Set(pointHits.map((p) => uvPointKey(p.faceIndex, p.uvIndex)))];
    setSelectedUvPoints((current) => {
      if (mode === 'replace') return keys;
      if (mode === 'add') {
        const next = new Set(current);
        keys.forEach((k) => next.add(k));
        return [...next];
      }
      const remove = new Set(keys);
      return current.filter((k) => !remove.has(k));
    });
  };

  const transformSelection = (kind, amount) => {
    if (!mesh || !object) return;
    const faces = localSelection.length > 0 ? localSelection : mesh.faces.map((_, i) => i);
    if (faces.length === 0) return;
    const selectedPoints = faces.flatMap((fi) => uvMap[fi] ?? []);
    const center = polygonCenter(selectedPoints);
    const next = {};
    for (const fi of faces) {
      next[fi] = (uvMap[fi] ?? []).map(([u, v]) => {
        let nu = u;
        let nv = v;
        if (kind === 'moveX') nu += amount;
        if (kind === 'moveY') nv += amount;
        if (kind === 'scale') {
          nu = center[0] + (u - center[0]) * amount;
          nv = center[1] + (v - center[1]) * amount;
        }
        if (kind === 'rotate') {
          const a = amount;
          const dx = u - center[0];
          const dy = v - center[1];
          nu = center[0] + dx * Math.cos(a) - dy * Math.sin(a);
          nv = center[1] + dx * Math.sin(a) + dy * Math.cos(a);
        }
        if (kind === 'rotate90') {
          const dx = u - center[0];
          const dy = v - center[1];
          nu = center[0] - dy;
          nv = center[1] + dx;
        }
        if (kind === 'flipH') {
          nu = center[0] - (u - center[0]);
          nv = v;
        }
        if (kind === 'flipV') {
          nu = u;
          nv = center[1] - (v - center[1]);
        }
        if (snap) {
          nu = Math.round(nu * 16) / 16;
          nv = Math.round(nv * 16) / 16;
        }
        return [clamp01(nu), clamp01(nv)];
      });
    }
    commitUVs(next);
  };

  const applyTransformToSelectedPoints = (kind) => {
    if (!mesh || !object || selectedUvPoints.length === 0) return false;
    const points = selectedUvPoints
      .map((key) => {
        const [faceIndex, uvIndex] = key.split(':').map((n) => Number(n));
        const coord = uvMap[faceIndex]?.[uvIndex];
        return coord ? { faceIndex, uvIndex, coord } : null;
      })
      .filter(Boolean);
    if (points.length === 0) return false;
    const center = polygonCenter(points.map((p) => p.coord));
    const next = {};
    for (const { faceIndex, uvIndex } of points) {
      if (!next[faceIndex]) next[faceIndex] = (uvMap[faceIndex] ?? []).map(([u, v]) => [u, v]);
      const [u, v] = next[faceIndex][uvIndex];
      let nu = u;
      let nv = v;
      if (kind === 'flipH') nu = center[0] - (u - center[0]);
      if (kind === 'flipV') nv = center[1] - (v - center[1]);
      if (kind === 'rotate90') {
        const dx = u - center[0];
        const dy = v - center[1];
        nu = center[0] - dy;
        nv = center[1] + dx;
      }
      if (snap) {
        nu = Math.round(nu * 16) / 16;
        nv = Math.round(nv * 16) / 16;
      }
      next[faceIndex][uvIndex] = [clamp01(nu), clamp01(nv)];
    }
    commitUVs(next);
    return true;
  };

  const flipUvHorizontally = () => {
    if (!mesh || !object) return;
    if (applyTransformToSelectedPoints('flipH')) return;
    if (localSelection.length > 0) {
      transformSelection('flipH');
      return;
    }
    flipAllUvsHorizontally();
  };

  const flipTextureHorizontally = () => {
    if (!object?.textureDataUrl) return;
    const imgEl = new Image();
    imgEl.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = imgEl.naturalWidth;
      canvas.height = imgEl.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(imgEl, 0, 0);
      setObjectImageTextureLayer(object.id, canvas.toDataURL('image/png'));
    };
    imgEl.src = object.textureDataUrl;
  };

  const flipAllUvsVertically = () => {
    if (!mesh || !object) return;
    const allFaces = mesh.faces.map((_, i) => i);
    const allPoints = allFaces.flatMap((fi) => uvMap[fi] ?? []);
    const center = polygonCenter(allPoints);
    const next = {};
    for (const fi of allFaces) {
      next[fi] = (uvMap[fi] ?? []).map(([u, v]) => [u, clamp01(center[1] - (v - center[1]))]);
    }
    commitUVs(next);
  };

  const flipUvVertically = () => {
    if (!mesh || !object) return;
    if (applyTransformToSelectedPoints('flipV')) return;
    if (localSelection.length > 0) {
      transformSelection('flipV');
      return;
    }
    flipAllUvsVertically();
  };

  const rotateUvSelection90 = () => {
    if (!mesh || !object) return;
    if (applyTransformToSelectedPoints('rotate90')) return;
    transformSelection('rotate90');
  };

  const flipAllUvsHorizontally = () => {
    if (!mesh || !object) return;
    const allFaces = mesh.faces.map((_, i) => i);
    const allPoints = allFaces.flatMap((fi) => uvMap[fi] ?? []);
    const center = polygonCenter(allPoints);
    const next = {};
    for (const fi of allFaces) {
      next[fi] = (uvMap[fi] ?? []).map(([u, v]) => [clamp01(center[0] - (u - center[0])), v]);
    }
    commitUVs(next);
  };

  const unwrapSelection = () => {
    if (!mesh || !object || localSelection.length === 0) return;
    const objectScale = object.scale ?? [1, 1, 1];
    let next = {};
    if (unwrapMode === 'seams') {
      next = seamAwareUnwrap(mesh, localSelection, mesh.uvSeamEdges ?? [], atlasPadding);
    } else if (unwrapMode === 'smart') {
      next = smartAtlasUnwrap(mesh, localSelection, objectScale, atlasPadding);
    } else {
      for (const fi of localSelection) next[fi] = unwrapFace(mesh, fi, unwrapMode, objectScale);
    }
    commitUVs(next);
  };

  const selectAllFaces = () => {
    if (!mesh) return;
    const faces = mesh.faces.map((_, i) => i);
    setLocalSelection(faces);
    setSelectedUvPoints([]);
    if (faces.length === 0) return;
    selectFace(faces[0], 'replace');
    for (const fi of faces.slice(1)) selectFace(fi, 'add');
  };

  const clearUvSelection = () => {
    setLocalSelection([]);
    setSelectedUvPoints([]);
    clearSubSelection();
  };

  const resetUvView = () => setUvView({ zoom: 1, panX: 0, panY: 0 });

  const runUvMenuAction = (action) => {
    setUvMenuOpen(null);
    action();
  };

  useEffect(() => {
    if (!uvEditorOpen) return undefined;
    const onKeyDown = (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
      if (event.key.toLowerCase() === 'u') {
        event.preventDefault();
        unwrapSelection();
      }
      if (event.key.toLowerCase() === 'a') {
        if (!mesh) return;
        event.preventDefault();
        selectAllFaces();
      }
      if (event.key.toLowerCase() === 'h' && event.shiftKey) {
        if (!mesh) return;
        event.preventDefault();
        flipUvHorizontally();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [uvEditorOpen, mesh, object, localSelection, unwrapMode, uvMap, selectFace]);

  useEffect(() => {
    if (!uvEditorOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menubarRef.current) return;
      if (!menubarRef.current.contains(event.target)) {
        setUvMenuOpen(null);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [uvEditorOpen]);

  const selectUvFace = (faceIndex, event) => {
    const mode = selectModeFromEvent(event);
    setLocalSelection((current) => applyListSelection(current, faceIndex, mode));
    setSelectedUvPoints([]);
    selectFace(faceIndex, mode);
  };

  const canvasPointToUv = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    const { uvWidth, uvHeight, left, top } = getUvCanvasView(canvas, uvView, image);
    return {
      x,
      y,
      uv: [(x - left) / uvWidth, 1 - (y - top) / uvHeight],
    };
  };

  const handlePointerDown = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      dragRef.current = {
        type: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPanX: uvView.panX,
        startPanY: uvView.panY,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (!mesh || !object) return;
    const { x, y, uv } = canvasPointToUv(e.currentTarget, e.clientX, e.clientY);
    const { uvWidth, uvHeight, left, top } = getUvCanvasView(e.currentTarget, uvView, image);

    if (e.button !== 0) return;

    const handleData = tool === 'select' ? getSelectionHandlePoints(e.currentTarget) : null;
    if (handleData) {
      const hitRadius = 11;
      let hitHandle = null;
      for (const [key, p] of Object.entries(handleData.points)) {
        if (Math.hypot(p.x - x, p.y - y) <= hitRadius) {
          hitHandle = key;
          break;
        }
      }
      const insideBox =
        x >= handleData.box.left &&
        x <= handleData.box.right &&
        y >= handleData.box.top &&
        y <= handleData.box.bottom;
      if (hitHandle || insideBox) {
        const selectedPoints = localSelection.flatMap((fi) => uvMap[fi] ?? []);
        const center = polygonCenter(selectedPoints);
        dragRef.current = {
          type: 'handle',
          handle: hitHandle ?? 'move',
          start: uv,
          startUVs: makeUvMap(mesh, uvMap),
          faces: [...localSelection],
          center,
          startAngle: Math.atan2(uv[1] - center[1], uv[0] - center[0]),
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        setSelectedUvPoints([]);
        return;
      }
    }

    let pointHit = null;
    for (let fi = mesh.faceCount - 1; fi >= 0; fi--) {
      const uvs = uvMap[fi] ?? [];
      for (let ui = uvs.length - 1; ui >= 0; ui--) {
        const sx = left + uvs[ui][0] * uvWidth;
        const sy = top + (1 - uvs[ui][1]) * uvHeight;
        if (Math.hypot(sx - x, sy - y) <= POINT_PICK_PX) {
          pointHit = { faceIndex: fi, uvIndex: ui };
          break;
        }
      }
      if (pointHit) break;
    }

    if (pointHit) {
      const mode = selectModeFromEvent(e);
      applyUvPointSelection([pointHit], mode);
      const pointKey = uvPointKey(pointHit.faceIndex, pointHit.uvIndex);
      const alreadySelected = selectedUvPoints.includes(pointKey);
      if (!localSelection.includes(pointHit.faceIndex)) {
        setLocalSelection([pointHit.faceIndex]);
        selectFace(pointHit.faceIndex, 'replace');
      }
      const dragPoints =
        mode === 'remove'
          ? []
          : mode === 'replace'
            ? [pointHit]
            : alreadySelected
              ? selectedUvPoints
                  .map((k) => {
                    const [faceIndex, uvIndex] = k.split(':').map((n) => Number(n));
                    return { faceIndex, uvIndex };
                  })
                  .filter((p) => !(mode === 'remove' && p.faceIndex === pointHit.faceIndex && p.uvIndex === pointHit.uvIndex))
              : [
                  ...selectedUvPoints.map((k) => {
                    const [faceIndex, uvIndex] = k.split(':').map((n) => Number(n));
                    return { faceIndex, uvIndex };
                  }),
                  pointHit,
                ];
      dragRef.current = {
        type: 'point',
        points: dragPoints.length > 0 ? dragPoints : [pointHit],
        start: uv,
        startUVs: makeUvMap(mesh, uvMap),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === 'point') {
      dragRef.current = {
        type: 'marquee',
        pointerId: e.pointerId,
        startX: x,
        startY: y,
        mode: selectModeFromEvent(e),
        active: false,
        rect: null,
        pointOnly: true,
      };
      setUvMarquee(null);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    let hit = -1;
    for (let fi = mesh.faceCount - 1; fi >= 0; fi--) {
      if (pointInPolygon(uv, uvMap[fi] ?? [])) {
        hit = fi;
        break;
      }
    }
    if (hit >= 0) {
      const mode = selectModeFromEvent(e);
      const nextSelection = applyListSelection(localSelection, hit, mode);
      setLocalSelection(nextSelection);
      selectFace(hit, mode);
      setSelectedUvPoints([]);
      const selectedPoints = nextSelection.flatMap((fi) => uvMap[fi] ?? []);
      const center = polygonCenter(selectedPoints);
      dragRef.current = {
        type: 'island',
        start: uv,
        startUVs: makeUvMap(mesh, uvMap),
        faces: nextSelection,
        center,
        startAngle: Math.atan2(uv[1] - center[1], uv[0] - center[0]),
        startDistance: Math.max(Math.hypot(uv[0] - center[0], uv[1] - center[1]), 0.0001),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    dragRef.current = {
      type: 'marquee',
      pointerId: e.pointerId,
      startX: x,
      startY: y,
      mode: selectModeFromEvent(e),
      active: false,
      rect: null,
      pointOnly: false,
    };
    setUvMarquee(null);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current) return;
    if (dragRef.current.type === 'pan') {
      const dpr = window.devicePixelRatio || 1;
      setUvView((current) => ({
        ...current,
        panX: dragRef.current.startPanX + (e.clientX - dragRef.current.startX) * dpr,
        panY: dragRef.current.startPanY + (e.clientY - dragRef.current.startY) * dpr,
      }));
      return;
    }

    const { x, y, uv } = canvasPointToUv(e.currentTarget, e.clientX, e.clientY);

    if (dragRef.current.type === 'marquee') {
      const dx = x - dragRef.current.startX;
      const dy = y - dragRef.current.startY;
      const dist = Math.hypot(dx, dy);
      if (!dragRef.current.active && dist >= UV_MARQUEE_DRAG_PX) {
        dragRef.current.active = true;
      }
      if (!dragRef.current.active) return;

      const left = Math.min(dragRef.current.startX, x);
      const right = Math.max(dragRef.current.startX, x);
      const top = Math.min(dragRef.current.startY, y);
      const bottom = Math.max(dragRef.current.startY, y);
      const rect = {
        left,
        top,
        right,
        bottom,
        crossing: x < dragRef.current.startX,
      };
      dragRef.current.rect = rect;
      setUvMarquee(rect);
      return;
    }

    if (!mesh || !object) return;
    const du = uv[0] - dragRef.current.start[0];
    const dv = uv[1] - dragRef.current.start[1];
    const next = {};

    if (dragRef.current.type === 'point') {
      for (const { faceIndex, uvIndex } of dragRef.current.points) {
        const source = next[faceIndex] ?? dragRef.current.startUVs[faceIndex] ?? [];
        next[faceIndex] = source.map(([u, v], i) => {
          if (i !== uvIndex) return [u, v];
          let nu = u + du;
          let nv = v + dv;
          if (snap) {
            nu = Math.round(nu * 16) / 16;
            nv = Math.round(nv * 16) / 16;
          }
          return [clamp01(nu), clamp01(nv)];
        });
      }
      commitUVs(next, { persist: false });
      return;
    }

    if (dragRef.current.type === 'handle') {
      const { center, handle, faces } = dragRef.current;
      const angleNow = Math.atan2(uv[1] - center[1], uv[0] - center[0]);
      const angleDelta = angleNow - dragRef.current.startAngle;
      const startVec = [
        dragRef.current.start[0] - center[0],
        dragRef.current.start[1] - center[1],
      ];
      const nowVec = [uv[0] - center[0], uv[1] - center[1]];

      let scaleX = 1;
      let scaleY = 1;
      if (handle === 'e' || handle === 'w' || handle === 'ne' || handle === 'se' || handle === 'nw' || handle === 'sw') {
        scaleX = safeScale(nowVec[0], startVec[0]);
      }
      if (handle === 'n' || handle === 's' || handle === 'ne' || handle === 'se' || handle === 'nw' || handle === 'sw') {
        scaleY = safeScale(nowVec[1], startVec[1]);
      }

      for (const fi of faces) {
        next[fi] = (dragRef.current.startUVs[fi] ?? []).map(([u, v]) => {
          let nu = u;
          let nv = v;
          if (handle === 'move') {
            nu = u + du;
            nv = v + dv;
          } else if (handle === 'rotate') {
            const dx = u - center[0];
            const dy = v - center[1];
            nu = center[0] + dx * Math.cos(angleDelta) - dy * Math.sin(angleDelta);
            nv = center[1] + dx * Math.sin(angleDelta) + dy * Math.cos(angleDelta);
          } else {
            const minScale = 0.03;
            const sx = Math.abs(scaleX) < minScale ? Math.sign(scaleX || 1) * minScale : scaleX;
            const sy = Math.abs(scaleY) < minScale ? Math.sign(scaleY || 1) * minScale : scaleY;
            nu = center[0] + (u - center[0]) * sx;
            nv = center[1] + (v - center[1]) * sy;
          }
          if (snap) {
            nu = Math.round(nu * 16) / 16;
            nv = Math.round(nv * 16) / 16;
          }
          return [clamp01(nu), clamp01(nv)];
        });
      }
      commitUVs(next, { persist: false });
      return;
    }

    const center = dragRef.current.center;

    for (const fi of dragRef.current.faces) {
      next[fi] = (dragRef.current.startUVs[fi] ?? []).map(([u, v]) => {
        let nu = u;
        let nv = v;
        nu += du;
        nv += dv;
        if (snap) {
          nu = Math.round(nu * 16) / 16;
          nv = Math.round(nv * 16) / 16;
        }
        return [clamp01(nu), clamp01(nv)];
      });
    }
    commitUVs(next, { persist: false });
  };

  const handlePointerUp = (e) => {
    if (dragRef.current?.type === 'marquee' && dragRef.current.active && mesh) {
      const rect = dragRef.current.rect ?? uvMarquee;
      if (rect) {
        const hitPoints = [];
        const hitFaces = [];
        const crossing = rect.crossing;
        const canvas = e.currentTarget;
        const { uvWidth, uvHeight, left, top } = getUvCanvasView(canvas, uvView, image);
        for (let fi = 0; fi < mesh.faceCount; fi++) {
          const pts = (uvMap[fi] ?? []).map(([u, v]) => ({
            x: left + u * uvWidth,
            y: top + (1 - v) * uvHeight,
          }));
          if (pts.length < 2) continue;
          const bounds = {
            left: Math.min(...pts.map((p) => p.x)),
            right: Math.max(...pts.map((p) => p.x)),
            top: Math.min(...pts.map((p) => p.y)),
            bottom: Math.max(...pts.map((p) => p.y)),
          };
          const hit = crossing
            ? boundsOverlap(bounds, rect) || pts.some((p) => pointInRect(p.x, p.y, rect))
            : pts.every((p) => pointInRect(p.x, p.y, rect));
          if (hit) hitFaces.push(fi);
          pts.forEach((p, uvIndex) => {
            if (pointInRect(p.x, p.y, rect)) hitPoints.push({ faceIndex: fi, uvIndex });
          });
        }
        applyUvPointSelection(hitPoints, dragRef.current.mode);
        if (!dragRef.current.pointOnly) {
          const pointFaces = [...new Set(hitPoints.map((p) => p.faceIndex))];
          applyUvFaceSelection([...new Set([...hitFaces, ...pointFaces])], dragRef.current.mode, false);
        }
      }
    }

    flushPendingUVs();
    dragRef.current = null;
    setUvMarquee(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  const handleUvWheel = (e) => {
    e.preventDefault();
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (e.clientX - rect.left) * dpr;
    const y = (e.clientY - rect.top) * dpr;
    const before = getUvCanvasView(canvas, uvView, image);
    const safeBeforeWidth = Math.max(before.uvWidth, 1e-6);
    const safeBeforeHeight = Math.max(before.uvHeight, 1e-6);
    const u = (x - before.left) / safeBeforeWidth;
    const v = (y - before.top) / safeBeforeHeight;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    setUvView((current) => {
      const zoom = Math.max(0.35, Math.min(8, current.zoom * factor));
      const imageWidth = image?.naturalWidth || image?.width || 0;
      const imageHeight = image?.naturalHeight || image?.height || 0;
      const aspect = imageWidth > 0 && imageHeight > 0 ? imageWidth / imageHeight : 1;
      const afterSize = Math.min(canvasWidth, canvasHeight) * UV_BASE_SIZE * zoom;
      const afterWidth = aspect >= 1 ? afterSize : afterSize * aspect;
      const afterHeight = aspect >= 1 ? afterSize / aspect : afterSize;
      return {
        zoom,
        panX: x - u * afterWidth - (canvasWidth - afterWidth) / 2,
        panY: y - v * afterHeight - (canvasHeight - afterHeight) / 2,
      };
    });
  };

  const loadImage = (file) => {
    if (!file || !file.type?.startsWith('image/') || !object) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const shouldOrientNewTexture = !object.textureDataUrl;
      setObjectImageTextureLayer(object.id, dataUrl);
      if (shouldOrientNewTexture) flipAllUvsHorizontally();
      const img = new Image();
      img.onload = () => setImage(img);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const createPaintableTexture = () => {
    if (!object) return;
    const canvas = document.createElement('canvas');
    canvas.width = image?.naturalWidth || image?.width || DEFAULT_TEXTURE_SIZE;
    canvas.height = image?.naturalHeight || image?.height || DEFAULT_TEXTURE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = DEFAULT_TEXTURE_BACKGROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = dataUrl;
    setObjectImageTextureLayer(object.id, dataUrl);
  };

  const paintImage = () => {
    if (object && !object.textureDataUrl) createPaintableTexture();
    openPixelEditor();
  };

  const exportImage = () => {
    if (!object?.textureDataUrl) return;
    saveBlob(
      dataUrlToBlob(object.textureDataUrl),
      `${safeName(object.name, 'texture')}-uv-texture.png`,
      'PNG texture',
    );
  };

  const handleUvDragOver = (e) => {
    const imageFile = getImageFileFromDataTransfer(e.dataTransfer);
    if (!imageFile) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = object ? 'copy' : 'none';
    setDragImageOver(true);
  };

  const handleUvDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragImageOver(false);
    }
  };

  const handleUvDrop = (e) => {
    const imageFile = getImageFileFromDataTransfer(e.dataTransfer);
    if (!imageFile) return;
    e.preventDefault();
    setDragImageOver(false);
    loadImage(imageFile);
  };

  if (!uvEditorOpen) return null;

  const content = (
    <div
      className={[
        'uvWindow',
        minimized ? 'minimized' : '',
        dragImageOver ? 'dragImageOver' : '',
      ].filter(Boolean).join(' ')}
      role="dialog"
      aria-label="UV Editor"
      style={{ left: `${windowPos.x}px`, top: `${windowPos.y}px` }}
      onDragOver={handleUvDragOver}
      onDragEnter={handleUvDragOver}
      onDragLeave={handleUvDragLeave}
      onDrop={handleUvDrop}
    >
      <div
        className="uvTitlebar"
        onPointerDown={beginWindowDrag}
        onPointerMove={moveWindowDrag}
        onPointerUp={endWindowDrag}
        onPointerCancel={endWindowDrag}
      >
        <span>UV Editor</span>
        <div className="uvTitlebarActions">
          <button
            type="button"
            className="uvMinimizeBtn"
            onClick={() => setMinimized((value) => !value)}
            title={minimized ? 'Restore UV Editor' : 'Minimize UV Editor'}
            aria-label={minimized ? 'Restore UV Editor' : 'Minimize UV Editor'}
          >
            {minimized ? '□' : '_'}
          </button>
          <button
            type="button"
            className="uvCloseBtn"
            onClick={closeUvEditorWithSave}
            title="Close UV Editor"
            aria-label="Close UV Editor"
          >
            <X size={14} />
          </button>
        </div>
      </div>
      {!minimized && (
        <>
          <div className="uvMenubar" ref={menubarRef}>
            <div className="uvMenuGroup">
              <button type="button" onClick={() => setUvMenuOpen((m) => (m === 'map' ? null : 'map'))}>
                Map
              </button>
              {uvMenuOpen === 'map' && (
                <div className="uvMenuDropdown">
                  <button type="button" onClick={() => runUvMenuAction(unwrapSelection)} disabled={!mesh || localSelection.length === 0}>
                    Unwrap Selection
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => fileRef.current?.click())} disabled={!object}>
                    Import Image...
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(createPaintableTexture)} disabled={!object}>
                    New Image
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(exportImage)} disabled={!object?.textureDataUrl}>
                    Export Image...
                  </button>
                </div>
              )}
            </div>
            <div className="uvMenuGroup">
              <button type="button" onClick={() => setUvMenuOpen((m) => (m === 'select' ? null : 'select'))}>
                Select
              </button>
              {uvMenuOpen === 'select' && (
                <div className="uvMenuDropdown">
                  <button type="button" onClick={() => runUvMenuAction(selectAllFaces)} disabled={!mesh}>
                    Select All
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(clearUvSelection)} disabled={localSelection.length === 0 && selectedUvPoints.length === 0}>
                    Clear Selection
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setTool('select'))}>
                    Select Tool
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setTool('point'))}>
                    Point Tool
                  </button>
                </div>
              )}
            </div>
            <div className="uvMenuGroup">
              <button type="button" onClick={() => setUvMenuOpen((m) => (m === 'edit' ? null : 'edit'))}>
                Edit
              </button>
              {uvMenuOpen === 'edit' && (
                <div className="uvMenuDropdown">
                  <button type="button" onClick={() => runUvMenuAction(flipUvHorizontally)} disabled={!mesh}>
                    Flip UVs Horizontal
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(flipTextureHorizontally)} disabled={!object?.textureDataUrl}>
                    Flip Texture Horizontal
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(flipUvVertically)} disabled={!mesh}>
                    Flip Vertical
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(rotateUvSelection90)} disabled={!mesh}>
                    Rotate 90
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(paintImage)} disabled={!object}>
                    Paint Image
                  </button>
                </div>
              )}
            </div>
            <div className="uvMenuGroup">
              <button type="button" onClick={() => setUvMenuOpen((m) => (m === 'options' ? null : 'options'))}>
                Options
              </button>
              {uvMenuOpen === 'options' && (
                <div className="uvMenuDropdown">
                  <button type="button" onClick={() => runUvMenuAction(resetUvView)}>
                    Fit View
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setSnap((v) => !v))}>
                    {snap ? 'Disable Snap To Grid' : 'Enable Snap To Grid'}
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setShowWire((v) => !v))}>
                    {showWire ? 'Hide Wireframe' : 'Show Wireframe'}
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setImageLayerView('texture-uv'))}>
                    View: Texture + UVs
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setImageLayerView('texture'))}>
                    View: Texture Only
                  </button>
                  <button type="button" onClick={() => runUvMenuAction(() => setImageLayerView('uv'))}>
                    View: UVs Only
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="uvToolbar">
            <div className="uvToolbarRow">
              <div className="uvToolbarGroup">
                <button
                  type="button"
                  className={tool === 'select' ? 'active' : ''}
                  onClick={() => setTool('select')}
                  title="Select islands and handles"
                  aria-label="Select tool"
                >
                  <MousePointer2 size={13} />
                </button>
                <button
                  type="button"
                  className={tool === 'point' ? 'active' : ''}
                  onClick={() => setTool('point')}
                  title="Select and move UV points"
                  aria-label="Point tool"
                >
                  <CircleDot size={13} />
                </button>
              </div>

              <div className="uvToolbarGroup">
                <select value={unwrapMode} onChange={(e) => setUnwrapMode(e.target.value)} title="Unwrap mode">
                  <option value="smart">Smart</option>
                  <option value="seams">Seams</option>
                  <option value="fill">Fill</option>
                  <option value="planar">Planar</option>
                  <option value="front">Front</option>
                  <option value="side">Side</option>
                  <option value="top">Top</option>
                </select>
                <label className="uvToolbarField" title="Atlas island padding">
                  Pad
                  <input
                    type="number"
                    min="0.005"
                    max="0.2"
                    step="0.005"
                    value={atlasPadding}
                    onChange={(e) => setAtlasPadding(Number(e.target.value) || 0.02)}
                  />
                </label>
                <select value={imageLayerView} onChange={(e) => setImageLayerView(e.target.value)} title="Canvas view">
                  <option value="texture-uv">Tex+UV</option>
                  <option value="texture">Texture</option>
                  <option value="uv">UVs</option>
                </select>
                <button
                  type="button"
                  onClick={unwrapSelection}
                  disabled={!mesh || localSelection.length === 0}
                  title="Unwrap selection (U)"
                >
                  <UnfoldVertical size={13} />
                </button>
              </div>

              <div className="uvToolbarGroup">
                <button
                  type="button"
                  onClick={flipUvHorizontally}
                  disabled={!mesh}
                  title="Flip UVs horizontal (Shift+H) — selection, points, or all"
                  aria-label="Flip UVs horizontal"
                >
                  <FlipHorizontal size={13} />
                </button>
                <button
                  type="button"
                  onClick={flipUvVertically}
                  disabled={!mesh}
                  title="Flip UVs vertical — selection, points, or all"
                  aria-label="Flip UVs vertical"
                >
                  <FlipVertical size={13} />
                </button>
                <button
                  type="button"
                  onClick={rotateUvSelection90}
                  disabled={!mesh}
                  title="Rotate 90° — selection, points, or all"
                  aria-label="Rotate 90 degrees"
                >
                  <RotateCw size={13} />
                </button>
              </div>

              <div className="uvToolbarGroup">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!object} title="Import image">
                  <ImagePlus size={13} />
                </button>
                <button type="button" onClick={createPaintableTexture} disabled={!object} title="New image">
                  New
                </button>
                <button type="button" onClick={paintImage} disabled={!object} title="Open pixel editor">
                  <Paintbrush size={13} />
                </button>
                <button
                  type="button"
                  onClick={flipTextureHorizontally}
                  disabled={!object?.textureDataUrl}
                  title="Flip texture horizontal"
                  aria-label="Flip texture horizontal"
                >
                  <FlipHorizontal size={13} />
                </button>
                <button type="button" onClick={exportImage} disabled={!object?.textureDataUrl} title="Export image">
                  <Download size={13} />
                </button>
                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    loadImage(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>

              <div className="uvToolbarGroup">
                <button type="button" onClick={selectAllFaces} disabled={!mesh} title="Select all faces">
                  All
                </button>
                <button
                  type="button"
                  onClick={clearUvSelection}
                  disabled={localSelection.length === 0 && selectedUvPoints.length === 0}
                  title="Clear selection"
                >
                  Clear
                </button>
                <button type="button" onClick={resetUvView} title="Fit view">
                  <Maximize2 size={13} />
                </button>
              </div>

              <div className="uvToolbarGroup uvToolbarGroup--grow">
                <button
                  type="button"
                  className={snap ? 'active' : ''}
                  onClick={() => setSnap((v) => !v)}
                  title="Snap to grid"
                  aria-label="Snap to grid"
                >
                  <Grid3X3 size={13} />
                </button>
                <button
                  type="button"
                  className={showWire ? 'active' : ''}
                  onClick={() => setShowWire((v) => !v)}
                  title="Show wireframe"
                  aria-label="Show wireframe"
                >
                  <ScanLine size={13} />
                </button>
                <span className="uvToolbarDivider" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => object && setObjectTexture(object.id, null)}
                  disabled={!object?.textureDataUrl}
                  title="Clear texture"
                >
                  <Trash2 size={13} />
                </button>
                <button type="button" className="uvToolbarPrimary" onClick={closeUvEditorWithSave} title="Save and close">
                  <Save size={13} />
                </button>
              </div>
            </div>
          </div>
          <div className="uvBody">
            <div className="uvCanvasPane">
              {mesh ? (
                <>
                  <canvas
                    ref={canvasRef}
                    className="uvCanvas"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onWheel={handleUvWheel}
                    onContextMenu={(e) => e.preventDefault()}
                  />
                  <div
                    className="uvStatusOverlay"
                    style={{
                      background: uvTheme.statusOverlayBg,
                      color: uvTheme.statusOverlayText,
                    }}
                  >
                    {object?.name ?? 'No mesh'} · {localSelection.length} face(s)
                  </div>
                  {dragImageOver && (
                    <div className="uvDropOverlay">
                      {object ? 'Drop image to apply texture' : 'Select a mesh object first'}
                    </div>
                  )}
                </>
              ) : (
                <div className="uvEmpty">Select a mesh object to edit UVs.</div>
              )}
            </div>
            <div className="uvPreviewPane" onContextMenu={(e) => e.preventDefault()}>
              <UVPreview3D
                object={object}
                selectedFaces={localSelection}
                showWire={showWire}
                meshRevision={meshRevision}
                onSelectFace={selectUvFace}
                onClearSelection={clearUvSelection}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );

  return content;
}
