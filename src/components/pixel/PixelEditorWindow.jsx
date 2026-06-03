import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Brush,
  Circle,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  Hand,
  ImagePlus,
  Maximize,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  Plus,
  Redo2,
  Save,
  Square,
  Trash2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore.js';
import { saveBlob, safeName } from '../../export/fileSave.js';
import { readKhedThemeVar, parseHex } from '../../lib/theme/readThemeVar.js';
import { PALETTES, PRESET_COLORS } from './palettes.js';

const DEFAULT_SIZE = 512;
const DEFAULT_TEXTURE_BACKGROUND = '#ffffff';
const MIN_IMAGE_SIZE = 8;
const MAX_IMAGE_SIZE = 4096;
const MIN_W = 640;
const MIN_H = 420;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 48;
const makeLayerId = () => `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const PIXEL_TOOLS = [
  { id: 'brush', label: 'Brush', key: 'B', icon: Brush },
  { id: 'pencil', label: 'Pixel Pencil', key: 'P', icon: Pencil },
  { id: 'eraser', label: 'Eraser', key: 'E', icon: Eraser },
  { id: 'line', label: 'Line', key: 'L', icon: Minus },
  { id: 'rect', label: 'Rect', key: 'R', icon: Square },
  { id: 'circle', label: 'Circle', key: 'C', icon: Circle },
  { id: 'fill', label: 'Fill', key: 'F', icon: PaintBucket },
  { id: 'eyedropper', label: 'Pick Color', key: 'I', icon: Pipette },
  { id: 'hand', label: 'Pan', key: 'H', icon: Hand },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function createChecker(ctx, w, h, cell = 12, light = '#d9d9d9', dark = '#b4b4b4') {
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      ctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? light : dark;
      ctx.fillRect(x, y, cell, cell);
    }
  }
}

function hexToRgba(hex, alpha = 1) {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function rgbaToHex(data, index) {
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(data[index])}${toHex(data[index + 1])}${toHex(data[index + 2])}`;
}

export function PixelEditorWindow() {
  const fileRef = useRef(null);
  const viewRef = useRef(null);
  const baseCanvasRef = useRef(/** @type {HTMLCanvasElement | null} */ (null));
  const layerCanvasesRef = useRef(new Map());
  const dragRef = useRef(null);
  const winDragRef = useRef(null);
  const resizeRef = useRef(null);
  const liveUpdateRef = useRef(false);
  const lastTextureCommitRef = useRef(0);
  const lastLocalTextureRef = useRef('');
  const suppressNextLayerCommitRef = useRef(false);
  const themeColorsRef = useRef({
    artboard: '#316ac5',
    brush: '#111827',
    checkerA: '#d9d9d9',
    checkerB: '#b4b4b4',
    eraserPreview: '#ffffff',
    gridStrong: 'rgba(26, 35, 45, 0.24)',
    gridWeak: 'rgba(26, 35, 45, 0.15)',
    uvGuide: 'rgba(235, 245, 255, 0.52)',
  });

  const pixelEditorOpen = useEditorStore((s) => s.pixelEditorOpen);
  const pixelPaintOnModel = useEditorStore((s) => s.pixelPaintOnModel);
  const setPixelPaintOnModel = useEditorStore((s) => s.setPixelPaintOnModel);
  const pixelTool = useEditorStore((s) => s.pixelTool);
  const setPixelTool = useEditorStore((s) => s.setPixelTool);
  const pixelFillEnabled = useEditorStore((s) => s.pixelFillEnabled);
  const setPixelFillEnabled = useEditorStore((s) => s.setPixelFillEnabled);
  const pixelColor = useEditorStore((s) => s.pixelColor);
  const setPixelColor = useEditorStore((s) => s.setPixelColor);
  const pixelBrushSize = useEditorStore((s) => s.pixelBrushSize);
  const setPixelBrushSize = useEditorStore((s) => s.setPixelBrushSize);
  const pixelOpacity = useEditorStore((s) => s.pixelOpacity);
  const setPixelOpacity = useEditorStore((s) => s.setPixelOpacity);
  const closePixelEditor = useEditorStore((s) => s.closePixelEditor);
  const themeId = useEditorStore((s) => s.themeId);
  const selectedId = useEditorStore((s) => s.selectedId);
  const pixelPaintTargetId = useEditorStore((s) => s.pixelPaintTargetId);
  const objects = useEditorStore((s) => s.objects);
  const setObjectTexture = useEditorStore((s) => s.setObjectTexture);
  const setObjectTexturePreviewCanvas = useEditorStore((s) => s.setObjectTexturePreviewCanvas);
  const setObjectTextureLayers = useEditorStore((s) => s.setObjectTextureLayers);
  const updateObject = useEditorStore((s) => s.updateObject);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const object = objects.find((o) => o.id === selectedId) ?? objects.find((o) => o.id === pixelPaintTargetId);

  const tool = pixelTool;
  const color = pixelColor;
  const brushSize = pixelBrushSize;
  const opacity = pixelOpacity;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [minimized, setMinimized] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 90, y: 40 });
  const [windowSize, setWindowSize] = useState({ w: 860, h: 560 });
  const [dragOver, setDragOver] = useState(false);
  const [docSize, setDocSize] = useState({ w: DEFAULT_SIZE, h: DEFAULT_SIZE });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [showGrid, setShowGrid] = useState(true);
  const [showUvGuide, setShowUvGuide] = useState(true);
  const [imageOpacityOnly, setImageOpacityOnly] = useState(true);
  const [mirrorPaintX, setMirrorPaintX] = useState(false);
  const [mirrorPaintY, setMirrorPaintY] = useState(false);
  const [cursorPixel, setCursorPixel] = useState(null);
  const [recentColors, setRecentColors] = useState(PRESET_COLORS);
  const [paletteName, setPaletteName] = useState('pico');
  const [customColors, setCustomColors] = useState([]);
  const [layers, setLayers] = useState(() => [{ id: makeLayerId(), name: 'Layer 1', visible: true, opacity: 1 }]);
  const [activeLayerId, setActiveLayerId] = useState(() => layers[0]?.id ?? null);
  const [draggingLayerId, setDraggingLayerId] = useState(null);
  const [dragOverLayerId, setDragOverLayerId] = useState(null);
  const [newImageDialogOpen, setNewImageDialogOpen] = useState(false);
  const [newImageDraft, setNewImageDraft] = useState({
    name: 'New Image',
    width: DEFAULT_SIZE,
    height: DEFAULT_SIZE,
    transparent: false,
    background: DEFAULT_TEXTURE_BACKGROUND,
    backgroundOpacity: 1,
  });

  const title = useMemo(
    () => `${object?.name ?? 'No object'} · ${docSize.w}x${docSize.h}`,
    [object?.name, docSize.w, docSize.h],
  );

  const activeTool = PIXEL_TOOLS.find((t) => t.id === tool) ?? PIXEL_TOOLS[0];
  const paletteColors = [...(PALETTES[paletteName]?.colors ?? PRESET_COLORS), ...customColors];
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null;
  const imageLayer = layers.find((layer) => layer.kind === 'image') ?? layers[0] ?? null;
  const imageOpacityLayer = imageOpacityOnly ? imageLayer : activeLayer;
  const imageOpacityPercent = Math.round((imageOpacityLayer?.opacity ?? 1) * 100);
  const objectTextureLayerKey = useMemo(
    () => JSON.stringify((object?.textureLayers ?? []).map((layer) => [
      layer.id,
      layer.name,
      layer.visible,
      layer.opacity,
      layer.kind,
      layer.dataUrl,
    ])),
    [object?.textureLayers],
  );

  const rememberColor = (nextColor) => {
    setRecentColors((current) => [nextColor, ...current.filter((c) => c !== nextColor)].slice(0, 16));
  };

  const setActiveColor = (nextColor) => {
    setPixelColor(nextColor);
    rememberColor(nextColor);
  };

  const ensureBaseCanvas = () => {
    if (!baseCanvasRef.current) {
      baseCanvasRef.current = document.createElement('canvas');
      baseCanvasRef.current.width = DEFAULT_SIZE;
      baseCanvasRef.current.height = DEFAULT_SIZE;
      const ctx = baseCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, DEFAULT_SIZE, DEFAULT_SIZE);
    }
    return baseCanvasRef.current;
  };

  const ensureLayerCanvas = (layerId = activeLayerId, w = docSize.w, h = docSize.h) => {
    if (!layerId) return null;
    let canvas = layerCanvasesRef.current.get(layerId);
    if (!canvas) {
      canvas = document.createElement('canvas');
      layerCanvasesRef.current.set(layerId, canvas);
    }
    if (canvas.width !== w || canvas.height !== h) {
      const previous = document.createElement('canvas');
      previous.width = canvas.width || w;
      previous.height = canvas.height || h;
      previous.getContext('2d')?.drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, w, h);
      ctx?.drawImage(previous, 0, 0);
    }
    return canvas;
  };

  const compositeLayers = (layerList = layers) => {
    const base = ensureBaseCanvas();
    const ctx = base.getContext('2d');
    if (!ctx) return base;
    ctx.clearRect(0, 0, base.width, base.height);
    for (const layer of layerList) {
      if (!layer.visible) continue;
      const layerCanvas = ensureLayerCanvas(layer.id, base.width, base.height);
      if (!layerCanvas) continue;
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layerCanvas, 0, 0);
      ctx.restore();
    }
    return base;
  };

  const serializeTextureLayers = (layerList = layers) => {
    const base = ensureBaseCanvas();
    return layerList.map((layer) => {
      const canvas = ensureLayerCanvas(layer.id, base.width, base.height);
      return {
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        kind: layer.kind ?? 'paint',
        dataUrl: canvas ? canvas.toDataURL('image/png') : null,
      };
    });
  };

  const getActiveLayerContext = () => {
    const base = ensureBaseCanvas();
    let paintTargetId = activeLayerId;
    if (imageOpacityOnly && activeLayer?.kind === 'image') {
      paintTargetId = layers.find((layer) => layer.kind === 'paint')?.id ?? makeLayerId();
      if (!layers.some((layer) => layer.id === paintTargetId)) {
        ensureLayerCanvas(paintTargetId, base.width, base.height);
        setLayers((current) => [...current, { id: paintTargetId, name: 'Paint', visible: true, opacity: 1, kind: 'paint' }]);
      }
    }
    if (paintTargetId && paintTargetId !== activeLayerId) setActiveLayerId(paintTargetId);
    const layerCanvas = ensureLayerCanvas(paintTargetId, base.width, base.height);
    return layerCanvas?.getContext('2d') ?? null;
  };

  const mirroredPixelPairs = (a, b = null) => {
    const points = [[a, b]];
    if (mirrorPaintX) points.push([{ x: docSize.w - 1 - a.x, y: a.y }, b ? { x: docSize.w - 1 - b.x, y: b.y } : null]);
    if (mirrorPaintY) points.push([{ x: a.x, y: docSize.h - 1 - a.y }, b ? { x: b.x, y: docSize.h - 1 - b.y } : null]);
    if (mirrorPaintX && mirrorPaintY) {
      points.push([
        { x: docSize.w - 1 - a.x, y: docSize.h - 1 - a.y },
        b ? { x: docSize.w - 1 - b.x, y: docSize.h - 1 - b.y } : null,
      ]);
    }
    const seen = new Set();
    return points.filter(([p0, p1]) => {
      const key = `${p0.x},${p0.y}:${p1?.x ?? ''},${p1?.y ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const flipActiveLayer = (axis) => {
    const canvas = ensureLayerCanvas(activeLayerId, docSize.w, docSize.h);
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    pushUndo();
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d')?.drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (axis === 'x') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }
    ctx.drawImage(copy, 0, 0);
    ctx.restore();
    renderView();
    applyTexture(true);
  };

  const renderView = () => {
    const view = viewRef.current;
    const base = compositeLayers();
    if (!view || !base) return;
    const rect = view.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (view.width !== w || view.height !== h) {
      view.width = w;
      view.height = h;
    }
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const theme = themeColorsRef.current;
    createChecker(ctx, w, h, 16, theme.checkerA, theme.checkerB);
    const drawW = base.width * zoom;
    const drawH = base.height * zoom;
    const left = (w - drawW) / 2 + pan.x;
    const top = (h - drawH) / 2 + pan.y;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, left, top, drawW, drawH);

    if (showGrid && zoom >= 6) {
      const step = zoom;
      ctx.save();
      ctx.strokeStyle = zoom >= 12 ? theme.gridStrong : theme.gridWeak;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= base.width; x++) {
        const px = Math.round(left + x * step) + 0.5;
        ctx.moveTo(px, top);
        ctx.lineTo(px, top + drawH);
      }
      for (let y = 0; y <= base.height; y++) {
        const py = Math.round(top + y * step) + 0.5;
        ctx.moveTo(left, py);
        ctx.lineTo(left + drawW, py);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Light UV guide overlay (Blockbench-style reference while painting).
    if (showUvGuide && object?.mesh?.faceUVs?.length) {
      ctx.save();
      ctx.strokeStyle = theme.uvGuide;
      ctx.lineWidth = 1.1;
      for (const uvs of object.mesh.faceUVs) {
        if (!uvs || uvs.length < 2) continue;
        ctx.beginPath();
        for (let i = 0; i < uvs.length; i++) {
          const uv = uvs[i];
          const px = left + uv[0] * drawW;
          const py = top + (1 - uv[1]) * drawH;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.strokeStyle = theme.artboard;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(left, top, drawW, drawH);

    if (cursorPixel?.inside && cursorPixel.x >= 0 && cursorPixel.y >= 0 && cursorPixel.x < base.width && cursorPixel.y < base.height) {
      const previewSize = Math.max(1, brushSize);
      const px = left + cursorPixel.x * zoom;
      const py = top + cursorPixel.y * zoom;
      const wh = previewSize * zoom;
      ctx.save();
      ctx.strokeStyle = tool === 'eraser' ? theme.eraserPreview : theme.brush;
      ctx.lineWidth = 1;
      ctx.setLineDash(tool === 'eraser' ? [4, 3] : []);
      ctx.strokeRect(px - ((previewSize - 1) * zoom) / 2, py - ((previewSize - 1) * zoom) / 2, wh, wh);
      ctx.restore();
    }
  };

  const saveSnapshot = () => {
    const base = ensureBaseCanvas();
    return {
      layers: layers.map((layer) => {
        const canvas = ensureLayerCanvas(layer.id, base.width, base.height);
        const ctx = canvas?.getContext('2d');
        return {
          meta: { ...layer },
          image: ctx?.getImageData(0, 0, base.width, base.height) ?? null,
        };
      }),
      activeLayerId,
    };
  };

  const restoreSnapshot = (snapshot, commit = false) => {
    if (!snapshot) return;
    const base = ensureBaseCanvas();
    layerCanvasesRef.current.clear();
    const nextLayers = snapshot.layers.map(({ meta, image }) => {
      const canvas = ensureLayerCanvas(meta.id, base.width, base.height);
      const ctx = canvas?.getContext('2d');
      if (ctx && image) ctx.putImageData(image, 0, 0);
      return { ...meta };
    });
    setLayers(nextLayers);
    setActiveLayerId(snapshot.activeLayerId ?? nextLayers[0]?.id ?? null);
    const composite = compositeLayers(nextLayers);
    if (commit && object) {
      const dataUrl = composite.toDataURL('image/png');
      lastLocalTextureRef.current = dataUrl;
      setObjectTextureLayers(object.id, serializeTextureLayers(nextLayers), dataUrl, { skipHistory: true });
    }
    renderView();
  };

  const pushUndo = () => {
    const snap = saveSnapshot();
    if (!snap) return;
    setUndoStack((s) => [...s.slice(-30), snap]);
    setRedoStack([]);
  };

  const saveActiveLayerSnapshot = () => {
    const base = ensureBaseCanvas();
    const layerCanvas = ensureLayerCanvas(activeLayerId, base.width, base.height);
    const ctx = layerCanvas?.getContext('2d');
    if (!ctx) return null;
    return {
      layerId: activeLayerId,
      image: ctx.getImageData(0, 0, base.width, base.height),
    };
  };

  const restoreActiveLayerSnapshot = (snapshot) => {
    if (!snapshot?.layerId || !snapshot.image) return;
    const base = ensureBaseCanvas();
    const layerCanvas = ensureLayerCanvas(snapshot.layerId, base.width, base.height);
    const ctx = layerCanvas?.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(snapshot.image, 0, 0);
    compositeLayers();
    renderView();
  };

  const applyTexture = (skipHistory = true) => {
    if (!object) return;
    const base = compositeLayers();
    const dataUrl = base.toDataURL('image/png');
    lastLocalTextureRef.current = dataUrl;
    setObjectTextureLayers(object.id, serializeTextureLayers(), dataUrl, { skipHistory });
    lastTextureCommitRef.current = performance.now();
  };

  const applyTextureFromLayers = (layerList, skipHistory = true) => {
    if (!object) return;
    const base = compositeLayers(layerList);
    const dataUrl = base.toDataURL('image/png');
    lastLocalTextureRef.current = dataUrl;
    setObjectTextureLayers(object.id, serializeTextureLayers(layerList), dataUrl, { skipHistory });
    lastTextureCommitRef.current = performance.now();
  };

  const previewTexture = () => {
    if (!object) return;
    const base = compositeLayers();
    setObjectTexturePreviewCanvas(object.id, base);
  };

  const pixelDocHasContent = () => {
    if (undoStack.length > 0 || layers.length > 1) return true;
    if (object?.textureDataUrl) return true;
    const base = ensureBaseCanvas();
    const ctx = base.getContext('2d');
    if (!ctx || base.width === 0 || base.height === 0) return false;
    const { data } = ctx.getImageData(0, 0, base.width, base.height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true;
    }
    return false;
  };

  const openNewImageDialog = () => {
    setNewImageDraft({
      name: object?.name?.trim() || 'New Image',
      width: docSize.w,
      height: docSize.h,
      transparent: false,
      background: DEFAULT_TEXTURE_BACKGROUND,
      backgroundOpacity: 1,
    });
    setNewImageDialogOpen(true);
  };

  const confirmNewImage = () => {
    const name = newImageDraft.name.trim() || 'New Image';
    const w = clamp(
      Math.round(Number(newImageDraft.width) || DEFAULT_SIZE),
      MIN_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
    );
    const h = clamp(
      Math.round(Number(newImageDraft.height) || DEFAULT_SIZE),
      MIN_IMAGE_SIZE,
      MAX_IMAGE_SIZE,
    );
    setNewImageDialogOpen(false);
    resetNewImage(w, h, name, {
      transparent: !!newImageDraft.transparent,
      background: newImageDraft.background || DEFAULT_TEXTURE_BACKGROUND,
      backgroundOpacity: clamp(Number(newImageDraft.backgroundOpacity) || 0, 0, 1),
    });
  };

  const resetNewImage = (
    w = DEFAULT_SIZE,
    h = DEFAULT_SIZE,
    imageName = 'New Image',
    options = {},
  ) => {
    const transparent = !!options.transparent;
    const background = options.background || DEFAULT_TEXTURE_BACKGROUND;
    const backgroundOpacity =
      transparent || options.backgroundOpacity == null
        ? transparent ? 0 : 1
        : clamp(Number(options.backgroundOpacity) || 0, 0, 1);
    const base = ensureBaseCanvas();
    base.width = w;
    base.height = h;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    const layerId = makeLayerId();
    layerCanvasesRef.current.clear();
    const layerCanvas = ensureLayerCanvas(layerId, w, h);
    const layerCtx = layerCanvas?.getContext('2d');
    layerCtx?.clearRect(0, 0, w, h);
    if (backgroundOpacity > 0 && layerCtx) {
      layerCtx.fillStyle = hexToRgba(background, backgroundOpacity);
      layerCtx.fillRect(0, 0, w, h);
    }
    let nextLayers = [
      {
        id: layerId,
        name: backgroundOpacity > 0 ? 'Background' : 'Layer 1',
        visible: true,
        opacity: 1,
        kind: backgroundOpacity > 0 ? 'image' : 'paint',
      },
    ];
    let nextActiveLayerId = layerId;
    if (imageOpacityOnly && backgroundOpacity > 0) {
      const paintLayerId = makeLayerId();
      const paintCanvas = ensureLayerCanvas(paintLayerId, w, h);
      paintCanvas?.getContext('2d')?.clearRect(0, 0, w, h);
      nextLayers = [
        nextLayers[0],
        { id: paintLayerId, name: 'Paint', visible: true, opacity: 1, kind: 'paint' },
      ];
      nextActiveLayerId = paintLayerId;
    }
    setLayers(nextLayers);
    setActiveLayerId(nextActiveLayerId);
    setDocSize({ w, h });
    setUndoStack([]);
    setRedoStack([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    if (object?.id) {
      updateObject(object.id, { name: imageName }, { skipHistory: true });
    }
    applyTextureFromLayers(nextLayers, false);
  };

  const fitView = () => {
    const view = viewRef.current;
    const base = ensureBaseCanvas();
    if (!view || !base) return;
    const rect = view.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const fitZoom = Math.min(
      (rect.width * dpr * 0.86) / base.width,
      (rect.height * dpr * 0.86) / base.height,
    );
    setZoom(clamp(fitZoom, MIN_ZOOM, MAX_ZOOM));
    setPan({ x: 0, y: 0 });
  };

  const loadImageToDoc = (img) => {
    const base = ensureBaseCanvas();
    base.width = img.width;
    base.height = img.height;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, img.width, img.height);
    const layerId = makeLayerId();
    const paintLayerId = makeLayerId();
    layerCanvasesRef.current.clear();
    const layerCanvas = ensureLayerCanvas(layerId, img.width, img.height);
    const layerCtx = layerCanvas?.getContext('2d');
    layerCtx?.clearRect(0, 0, img.width, img.height);
    layerCtx?.drawImage(img, 0, 0);
    const paintCanvas = ensureLayerCanvas(paintLayerId, img.width, img.height);
    paintCanvas?.getContext('2d')?.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    const nextLayers = imageOpacityOnly
      ? [
          { id: layerId, name: 'Imported', visible: true, opacity: 1, kind: 'image' },
          { id: paintLayerId, name: 'Paint', visible: true, opacity: 1, kind: 'paint' },
        ]
      : [{ id: layerId, name: 'Imported', visible: true, opacity: 1, kind: 'image' }];
    setLayers(nextLayers);
    setActiveLayerId(imageOpacityOnly ? paintLayerId : layerId);
    compositeLayers(nextLayers);
    setDocSize({ w: img.width, h: img.height });
    setUndoStack([]);
    setRedoStack([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    applyTextureFromLayers(nextLayers, false);
  };

  const syncExternalTextureToDoc = (img) => {
    suppressNextLayerCommitRef.current = true;
    const base = ensureBaseCanvas();
    const sameSize = base.width === img.width && base.height === img.height;
    if (!sameSize) {
      base.width = img.width;
      base.height = img.height;
      setDocSize({ w: img.width, h: img.height });
    }
    const ctx = base.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, img.width, img.height);
    const layerId = makeLayerId();
    const paintLayerId = makeLayerId();
    layerCanvasesRef.current.clear();
    const layerCanvas = ensureLayerCanvas(layerId, img.width, img.height);
    const layerCtx = layerCanvas?.getContext('2d');
    layerCtx?.clearRect(0, 0, img.width, img.height);
    layerCtx?.drawImage(img, 0, 0);
    const paintCanvas = ensureLayerCanvas(paintLayerId, img.width, img.height);
    paintCanvas?.getContext('2d')?.clearRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    const nextLayers = imageOpacityOnly
      ? [
          { id: layerId, name: 'Texture', visible: true, opacity: 1, kind: 'image' },
          { id: paintLayerId, name: 'Paint', visible: true, opacity: 1, kind: 'paint' },
        ]
      : [{ id: layerId, name: 'Texture', visible: true, opacity: 1, kind: 'image' }];
    setLayers(nextLayers);
    setActiveLayerId(imageOpacityOnly ? paintLayerId : layerId);
    compositeLayers(nextLayers);
    renderView();
  };

  const loadTextureLayersToDoc = async (textureLayers) => {
    const validLayers = Array.isArray(textureLayers)
      ? textureLayers.filter((layer) => layer && typeof layer === 'object')
      : [];
    if (validLayers.length === 0) return false;

    const loaded = await Promise.all(validLayers.map((layer) => new Promise((resolve) => {
      if (!layer.dataUrl) {
        resolve({ layer, img: null });
        return;
      }
      const img = new Image();
      img.onload = () => resolve({ layer, img });
      img.onerror = () => resolve({ layer, img: null });
      img.src = layer.dataUrl;
    })));
    const firstImage = loaded.find((item) => item.img)?.img;
    if (!firstImage) return false;

    suppressNextLayerCommitRef.current = true;
    const w = firstImage.naturalWidth || firstImage.width || DEFAULT_SIZE;
    const h = firstImage.naturalHeight || firstImage.height || DEFAULT_SIZE;
    const base = ensureBaseCanvas();
    base.width = w;
    base.height = h;
    layerCanvasesRef.current.clear();

    const nextLayers = loaded.map(({ layer, img }, index) => {
      const id = String(layer.id || makeLayerId());
      const canvas = ensureLayerCanvas(id, w, h);
      const ctx = canvas?.getContext('2d');
      ctx?.clearRect(0, 0, w, h);
      if (ctx && img) ctx.drawImage(img, 0, 0, w, h);
      return {
        id,
        name: String(layer.name || `Layer ${index + 1}`),
        visible: layer.visible !== false,
        opacity: Number.isFinite(Number(layer.opacity)) ? clamp(Number(layer.opacity), 0, 1) : 1,
        kind: typeof layer.kind === 'string' ? layer.kind : 'paint',
      };
    });
    setLayers(nextLayers);
    setActiveLayerId(
      (imageOpacityOnly ? nextLayers.find((layer) => layer.kind === 'paint') : null)?.id
        ?? nextLayers[0]?.id
        ?? null,
    );
    compositeLayers(nextLayers);
    setDocSize({ w, h });
    setUndoStack([]);
    setRedoStack([]);
    setPan({ x: 0, y: 0 });
    setZoom(1);
    renderView();
    return true;
  };

  const loadImageFile = (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => loadImageToDoc(img);
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const exportImage = () => {
    const base = compositeLayers();
    base.toBlob((blob) => {
      if (!blob) return;
      saveBlob(blob, `${safeName(object?.name, 'texture')}-${docSize.w}x${docSize.h}.png`, 'PNG texture');
    }, 'image/png');
  };

  const addLayer = () => {
    const base = ensureBaseCanvas();
    const id = makeLayerId();
    ensureLayerCanvas(id, base.width, base.height);
    setLayers((current) => [...current, { id, name: `Layer ${current.length + 1}`, visible: true, opacity: 1 }]);
    setActiveLayerId(id);
  };

  const duplicateLayer = () => {
    if (!activeLayer) return;
    const base = ensureBaseCanvas();
    const source = ensureLayerCanvas(activeLayer.id, base.width, base.height);
    const id = makeLayerId();
    const copy = ensureLayerCanvas(id, base.width, base.height);
    copy?.getContext('2d')?.drawImage(source, 0, 0);
    setLayers((current) => {
      const index = current.findIndex((layer) => layer.id === activeLayer.id);
      const nextLayer = { ...activeLayer, id, name: `${activeLayer.name} Copy` };
      const next = [...current];
      next.splice(index + 1, 0, nextLayer);
      return next;
    });
    setActiveLayerId(id);
  };

  const deleteLayer = () => {
    if (!activeLayer || layers.length <= 1) return;
    layerCanvasesRef.current.delete(activeLayer.id);
    setLayers((current) => {
      const next = current.filter((layer) => layer.id !== activeLayer.id);
      setActiveLayerId(next[Math.max(0, current.findIndex((layer) => layer.id === activeLayer.id) - 1)]?.id ?? next[0]?.id ?? null);
      return next;
    });
  };

  const updateLayer = (id, updates) => {
    setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ...updates } : layer)));
  };

  const ensurePaintLayer = () => {
    const base = ensureBaseCanvas();
    const existing = layers.find((layer) => layer.kind === 'paint' && layer.id !== imageLayer?.id);
    if (existing) {
      setActiveLayerId(existing.id);
      return existing.id;
    }
    const id = makeLayerId();
    ensureLayerCanvas(id, base.width, base.height);
    setLayers((current) => [...current, { id, name: 'Paint', visible: true, opacity: 1, kind: 'paint' }]);
    setActiveLayerId(id);
    return id;
  };

  const toggleImageOpacityOnly = (checked) => {
    setImageOpacityOnly(checked);
    if (checked) ensurePaintLayer();
  };

  const reorderLayersByDisplay = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    setLayers((current) => {
      const display = [...current].reverse();
      const from = display.findIndex((layer) => layer.id === sourceId);
      const to = display.findIndex((layer) => layer.id === targetId);
      if (from < 0 || to < 0) return current;
      const nextDisplay = [...display];
      const [moved] = nextDisplay.splice(from, 1);
      nextDisplay.splice(to, 0, moved);
      return nextDisplay.reverse();
    });
  };

  const canvasToPixel = (canvas, clientX, clientY) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    const base = ensureBaseCanvas();
    const drawW = base.width * zoom;
    const drawH = base.height * zoom;
    const left = (canvas.width - drawW) / 2 + pan.x;
    const top = (canvas.height - drawH) / 2 + pan.y;
    return {
      x: Math.floor((x - left) / zoom),
      y: Math.floor((y - top) / zoom),
      inside: x >= left && x < left + drawW && y >= top && y < top + drawH,
    };
  };

  const pickPixelColor = (x, y) => {
    const base = ensureBaseCanvas();
    if (x < 0 || y < 0 || x >= base.width || y >= base.height) return;
    const ctx = base.getContext('2d');
    if (!ctx) return;
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel[3] === 0) return;
    setActiveColor(rgbaToHex(pixel, 0));
  };

  const drawBrush = (ctx, x, y, rgba, size, erase = false) => {
    const r = Math.max(0.5, size - 0.5);
    ctx.save();
    if (erase) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.max(0, Math.min(1, rgba[3] / 255))})`;
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawPencil = (ctx, x, y, rgba, size, erase = false) => {
    const s = Math.max(1, Math.floor(size));
    const left = Math.floor(x - Math.floor(s / 2));
    const top = Math.floor(y - Math.floor(s / 2));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (erase) {
      ctx.clearRect(left, top, s, s);
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.max(0, Math.min(1, rgba[3] / 255))})`;
      ctx.fillRect(left, top, s, s);
    }
    ctx.restore();
  };

  const pixelLine = (ctx, x0, y0, x1, y1, rgba, size = 1, erase = false) => {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      drawPencil(ctx, x, y, rgba, size, erase);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  };

  const line = (ctx, x0, y0, x1, y1, rgba, size = 1) => {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      drawBrush(ctx, x, y, rgba, size, rgba[3] === 0);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  };

  const drawRect = (ctx, x0, y0, x1, y1, rgba, size = 1) => {
    line(ctx, x0, y0, x1, y0, rgba, size);
    line(ctx, x1, y0, x1, y1, rgba, size);
    line(ctx, x1, y1, x0, y1, rgba, size);
    line(ctx, x0, y1, x0, y0, rgba, size);
  };

  const fillRectPixels = (ctx, x0, y0, x1, y1, rgba) => {
    const left = Math.min(x0, x1);
    const top = Math.min(y0, y1);
    const width = Math.abs(x1 - x0) + 1;
    const height = Math.abs(y1 - y0) + 1;
    ctx.save();
    if (rgba[3] === 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.max(0, Math.min(1, rgba[3] / 255))})`;
    }
    ctx.fillRect(left, top, width, height);
    ctx.restore();
  };

  const drawCircle = (ctx, cx, cy, ex, ey, rgba, size = 1) => {
    const r = Math.max(1, Math.floor(Math.hypot(ex - cx, ey - cy)));
    const erase = rgba[3] === 0;
    let x = r;
    let y = 0;
    let err = 0;
    while (x >= y) {
      drawBrush(ctx, cx + x, cy + y, rgba, size, erase);
      drawBrush(ctx, cx + y, cy + x, rgba, size, erase);
      drawBrush(ctx, cx - y, cy + x, rgba, size, erase);
      drawBrush(ctx, cx - x, cy + y, rgba, size, erase);
      drawBrush(ctx, cx - x, cy - y, rgba, size, erase);
      drawBrush(ctx, cx - y, cy - x, rgba, size, erase);
      drawBrush(ctx, cx + y, cy - x, rgba, size, erase);
      drawBrush(ctx, cx + x, cy - y, rgba, size, erase);
      y += 1;
      if (err <= 0) err += 2 * y + 1;
      if (err > 0) {
        x -= 1;
        err -= 2 * x + 1;
      }
    }
  };

  const floodFill = (ctx, sx, sy, rgba) => {
    const base = ensureBaseCanvas();
    if (sx < 0 || sy < 0 || sx >= base.width || sy >= base.height) return;
    const image = ctx.getImageData(0, 0, base.width, base.height);
    const data = image.data;
    const idx = (x, y) => (y * base.width + x) * 4;
    const start = idx(sx, sy);
    const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
    if (target[0] === rgba[0] && target[1] === rgba[1] && target[2] === rgba[2] && target[3] === rgba[3]) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= base.width || y >= base.height) continue;
      const i = idx(x, y);
      if (
        data[i] !== target[0] ||
        data[i + 1] !== target[1] ||
        data[i + 2] !== target[2] ||
        data[i + 3] !== target[3]
      ) {
        continue;
      }
      data[i] = rgba[0];
      data[i + 1] = rgba[1];
      data[i + 2] = rgba[2];
      data[i + 3] = rgba[3];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(image, 0, 0);
  };

  const withLiveCommit = () => {
    if (liveUpdateRef.current) return;
    liveUpdateRef.current = true;
    requestAnimationFrame(() => {
      liveUpdateRef.current = false;
      renderView();
      const now = performance.now();
      if (now - lastTextureCommitRef.current >= 32) {
        previewTexture();
        lastTextureCommitRef.current = now;
      }
    });
  };

  const handlePointerDown = (e) => {
    if (e.button === 1 || (e.button === 0 && tool === 'hand')) {
      dragRef.current = {
        kind: 'pan',
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPan: { ...pan },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    const p = canvasToPixel(e.currentTarget, e.clientX, e.clientY);
    setCursorPixel(p);
    if (!p.inside) return;
    const ctx = getActiveLayerContext();
    if (!ctx) return;
    if (tool === 'eyedropper') {
      pickPixelColor(p.x, p.y);
      return;
    }
    const rgba = tool === 'eraser' ? [0, 0, 0, 0] : [...parseHex(color).slice(0, 3), Math.round(opacity * 255)];
    pushUndo();
    if (tool === 'fill') {
      for (const [mp] of mirroredPixelPairs({ x: p.x, y: p.y })) floodFill(ctx, mp.x, mp.y, rgba);
      renderView();
      applyTexture(true);
      return;
    }
    dragRef.current = {
      kind: 'draw',
      pointerId: e.pointerId,
      start: { x: p.x, y: p.y },
      last: { x: p.x, y: p.y },
      snapshot: saveActiveLayerSnapshot(),
    };
    if (tool === 'pencil') {
      for (const [mp] of mirroredPixelPairs({ x: p.x, y: p.y })) drawPencil(ctx, mp.x, mp.y, rgba, brushSize);
      withLiveCommit();
    }
    if (tool === 'brush' || tool === 'eraser') {
      for (const [mp] of mirroredPixelPairs({ x: p.x, y: p.y })) {
        drawBrush(ctx, mp.x, mp.y, rgba, brushSize, tool === 'eraser');
      }
      withLiveCommit();
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    const p = canvasToPixel(e.currentTarget, e.clientX, e.clientY);
    setCursorPixel(p);
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;
    if (drag.kind === 'pan') {
      const dpr = window.devicePixelRatio || 1;
      setPan({
        x: drag.startPan.x + (e.clientX - drag.startX) * dpr,
        y: drag.startPan.y + (e.clientY - drag.startY) * dpr,
      });
      return;
    }
    const ctx = getActiveLayerContext();
    if (!ctx || !p.inside) return;
    const rgba = tool === 'eraser' ? [0, 0, 0, 0] : [...parseHex(color).slice(0, 3), Math.round(opacity * 255)];
    if (tool === 'pencil') {
      for (const [start, end] of mirroredPixelPairs(drag.last, { x: p.x, y: p.y })) {
        pixelLine(ctx, start.x, start.y, end.x, end.y, rgba, brushSize);
      }
      drag.last = { x: p.x, y: p.y };
      withLiveCommit();
      return;
    }
    if (tool === 'brush' || tool === 'eraser') {
      for (const [start, end] of mirroredPixelPairs(drag.last, { x: p.x, y: p.y })) {
        line(ctx, start.x, start.y, end.x, end.y, rgba, brushSize);
      }
      drag.last = { x: p.x, y: p.y };
      withLiveCommit();
      return;
    }
    if (drag.snapshot) restoreActiveLayerSnapshot(drag.snapshot);
    if (tool === 'line') {
      for (const [start, end] of mirroredPixelPairs(drag.start, { x: p.x, y: p.y })) {
        line(ctx, start.x, start.y, end.x, end.y, rgba, brushSize);
      }
    }
    if (tool === 'rect') {
      for (const [start, end] of mirroredPixelPairs(drag.start, { x: p.x, y: p.y })) {
        if (pixelFillEnabled) fillRectPixels(ctx, start.x, start.y, end.x, end.y, rgba);
        drawRect(ctx, start.x, start.y, end.x, end.y, rgba, brushSize);
      }
    }
    if (tool === 'circle') {
      for (const [start, end] of mirroredPixelPairs(drag.start, { x: p.x, y: p.y })) {
        if (pixelFillEnabled) fillCirclePixels(ctx, start.x, start.y, end.x, end.y, rgba);
        drawCircle(ctx, start.x, start.y, end.x, end.y, rgba, brushSize);
      }
    }
    renderView();
  };

  const handlePointerUp = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    if (drag.kind === 'draw') {
      renderView();
      applyTexture(false);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const fillCirclePixels = (ctx, cx, cy, ex, ey, rgba) => {
    const r = Math.max(1, Math.floor(Math.hypot(ex - cx, ey - cy)));
    ctx.save();
    if (rgba[3] === 0) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${Math.max(0, Math.min(1, rgba[3] / 255))})`;
    }
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
    ctx.restore();
  };

  const handlePointerLeave = () => {
    setCursorPixel(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom((z) => clamp(z * factor, MIN_ZOOM, MAX_ZOOM));
  };

  const doUndo = () => {
    if (undoStack.length === 0) return;
    const current = saveSnapshot();
    const prev = undoStack[undoStack.length - 1];
    setUndoStack((s) => s.slice(0, -1));
    if (current) setRedoStack((s) => [...s.slice(-30), current]);
    restoreSnapshot(prev, true);
  };

  const doRedo = () => {
    if (redoStack.length === 0) return;
    const current = saveSnapshot();
    const next = redoStack[redoStack.length - 1];
    setRedoStack((s) => s.slice(0, -1));
    if (current) setUndoStack((s) => [...s.slice(-30), current]);
    restoreSnapshot(next, true);
  };

  const beginWindowDrag = (e) => {
    if (e.button !== 0 || e.target.closest('button,input,select,label')) return;
    winDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origin: { ...windowPos },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveWindowDrag = (e) => {
    const d = winDragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setWindowPos({
      x: clamp(d.origin.x + e.clientX - d.startX, 0, window.innerWidth - 180),
      y: clamp(d.origin.y + e.clientY - d.startY, 0, window.innerHeight - 40),
    });
  };

  const endWindowDrag = (e) => {
    if (winDragRef.current?.pointerId !== e.pointerId) return;
    winDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const beginResize = (e) => {
    if (e.button !== 0) return;
    resizeRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      size: { ...windowSize },
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const moveResize = (e) => {
    const d = resizeRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setWindowSize({
      w: clamp(d.size.w + (e.clientX - d.startX), MIN_W, window.innerWidth - 12),
      h: clamp(d.size.h + (e.clientY - d.startY), MIN_H, window.innerHeight - 12),
    });
  };

  const endResize = (e) => {
    if (resizeRef.current?.pointerId !== e.pointerId) return;
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onDragOver = (e) => {
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type?.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  };

  const onDrop = (e) => {
    const file = Array.from(e.dataTransfer.files ?? []).find((f) => f.type?.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    setDragOver(false);
    loadImageFile(file);
  };

  useEffect(() => {
    if (!pixelEditorOpen) return;
    ensureBaseCanvas();
    if (object?.textureLayers?.length) {
      loadTextureLayersToDoc(object.textureLayers);
      return;
    }
    if (object?.textureDataUrl) {
      const img = new Image();
      img.onload = () => loadImageToDoc(img);
      img.src = object.textureDataUrl;
      return;
    }
    resetNewImage(DEFAULT_SIZE, DEFAULT_SIZE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelEditorOpen, object?.id]);

  useEffect(() => {
    if (!pixelEditorOpen || !object?.id || !object.textureDataUrl) return;
    if (lastLocalTextureRef.current && object.textureDataUrl === lastLocalTextureRef.current) return;
    if (object.textureLayers?.length) {
      loadTextureLayersToDoc(object.textureLayers);
      return;
    }
    const img = new Image();
    img.onload = () => syncExternalTextureToDoc(img);
    img.src = object.textureDataUrl;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelEditorOpen, object?.id, object?.textureDataUrl, objectTextureLayerKey]);

  useEffect(() => {
    const brand = readKhedThemeVar('--t-brand', '#316ac5');
    const [r, g, b] = parseHex(brand);
    themeColorsRef.current = {
      artboard: brand,
      brush: readKhedThemeVar('--t-tool-text', '#111827'),
      checkerA: readKhedThemeVar('--t-pixel-checker-a', '#d9d9d9'),
      checkerB: readKhedThemeVar('--t-pixel-checker-b', '#b4b4b4'),
      eraserPreview: readKhedThemeVar('--t-accent-on', '#ffffff'),
      gridStrong: `rgba(${r}, ${g}, ${b}, 0.24)`,
      gridWeak: `rgba(${r}, ${g}, ${b}, 0.15)`,
      uvGuide: `rgba(${r}, ${g}, ${b}, 0.45)`,
    };
  }, [themeId]);

  useEffect(() => {
    if (!pixelEditorOpen) return;
    renderView();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pixelEditorOpen,
    windowSize,
    minimized,
    zoom,
    pan,
    docSize.w,
    docSize.h,
    object?.id,
    object?.mesh,
    meshRevision,
    showGrid,
    showUvGuide,
    cursorPixel,
    brushSize,
    tool,
    layers,
    activeLayerId,
    themeId,
  ]);

  useEffect(() => {
    if (!pixelEditorOpen || !object) return;
    renderView();
    if (suppressNextLayerCommitRef.current) {
      suppressNextLayerCommitRef.current = false;
      return;
    }
    applyTexture(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  useEffect(() => {
    if (!pixelEditorOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        doRedo();
        return;
      }
      const shortcut = PIXEL_TOOLS.find((t) => t.key.toLowerCase() === key);
      if (shortcut && (shortcut.id !== 'fill' || pixelFillEnabled)) {
        e.preventDefault();
        setPixelTool(shortcut.id);
        return;
      }
      if (key === '[') {
        e.preventDefault();
        setPixelBrushSize(clamp(brushSize - 1, 1, 64));
      } else if (key === ']') {
        e.preventDefault();
        setPixelBrushSize(clamp(brushSize + 1, 1, 64));
      } else if (key === '+' || key === '=') {
        e.preventDefault();
        setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM));
      } else if (key === '-' || key === '_') {
        e.preventDefault();
        setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM));
      } else if (key === '0') {
        e.preventDefault();
        fitView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelEditorOpen, brushSize, pixelFillEnabled, undoStack, redoStack]);

  if (!pixelEditorOpen) return null;

  return (
    <div
      className={[
        'pixelWindow',
        minimized ? 'minimized' : '',
        dragOver ? 'dragImageOver' : '',
      ].filter(Boolean).join(' ')}
      style={{ left: windowPos.x, top: windowPos.y, width: windowSize.w, height: minimized ? 24 : windowSize.h }}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="pixelTitlebar"
        onPointerDown={beginWindowDrag}
        onPointerMove={moveWindowDrag}
        onPointerUp={endWindowDrag}
        onPointerCancel={endWindowDrag}
      >
        <span>Pixel Editor</span>
        <span className="pixelTitleMeta">{title}</span>
        <div className="pixelTitlebarActions">
          <button type="button" className="uvMinimizeBtn" onClick={() => setMinimized((m) => !m)}>
            {minimized ? '□' : '_'}
          </button>
          <button type="button" className="uvCloseBtn" onClick={closePixelEditor}>
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div className="pixelToolbar">
            <div className="pixelToolbarRow pixelToolbarRow--draw">
              <div className="pixelToolbarGroup">
                <div className="pixelToolGroup" role="toolbar" aria-label="Pixel tools">
                  {PIXEL_TOOLS.map(({ id, label, key, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      className={tool === id ? 'active' : ''}
                      onClick={() => setPixelTool(id)}
                      disabled={id === 'fill' && !pixelFillEnabled}
                      title={`${label} (${key})`}
                      aria-label={label}
                    >
                      <Icon size={14} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="pixelToolbarGroup pixelToolbarGroup--brush">
                <label className="pixelToolbarField">
                  Color
                  <input type="color" value={color} onChange={(e) => setActiveColor(e.target.value)} />
                </label>
                <label className="pixelToolbarField">
                  Size
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={brushSize}
                    onChange={(e) => setPixelBrushSize(clamp(Number(e.target.value) || 1, 1, 64))}
                  />
                </label>
                <label className="pixelToolbarField">
                  Opacity
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(opacity * 100)}
                    onChange={(e) => setPixelOpacity(clamp((Number(e.target.value) || 0) / 100, 0, 1))}
                  />
                </label>
              </div>

              <div className="pixelToolbarGroup pixelToolbarGroup--modes">
                <button
                  type="button"
                  className={pixelFillEnabled ? 'active' : ''}
                  onClick={() => setPixelFillEnabled(!pixelFillEnabled)}
                >
                  Fill
                </button>
                <button
                  type="button"
                  className={pixelPaintOnModel ? 'active' : ''}
                  onClick={() => setPixelPaintOnModel(!pixelPaintOnModel)}
                  title="Paint on 3D model"
                >
                  3D
                </button>
              </div>
            </div>

            <div className="pixelToolbarRow pixelToolbarRow--secondary">
              <div className="pixelToolbarGroup pixelToolbarGroup--layer">
                <label className="pixelToolbarField">
                  Img
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={imageOpacityPercent}
                    disabled={!imageOpacityLayer}
                    onChange={(e) => {
                      if (!imageOpacityLayer) return;
                      updateLayer(imageOpacityLayer.id, {
                        opacity: clamp((Number(e.target.value) || 0) / 100, 0, 1),
                      });
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={imageOpacityPercent}
                    disabled={!imageOpacityLayer}
                    onChange={(e) => {
                      if (!imageOpacityLayer) return;
                      updateLayer(imageOpacityLayer.id, {
                        opacity: clamp((Number(e.target.value) || 0) / 100, 0, 1),
                      });
                    }}
                  />
                </label>
                <label className="pixelToolbarField pixelToolbarFieldCheck">
                  <input
                    type="checkbox"
                    checked={imageOpacityOnly}
                    onChange={(e) => toggleImageOpacityOnly(e.target.checked)}
                  />
                  Img only
                </label>
              </div>

              <div className="pixelToolbarGroup">
                <button
                  type="button"
                  className={showGrid ? 'active' : ''}
                  onClick={() => setShowGrid((v) => !v)}
                  title="Toggle pixel grid"
                  aria-label="Toggle pixel grid"
                >
                  <Grid3X3 size={13} />
                </button>
                <button
                  type="button"
                  className={showUvGuide ? 'active' : ''}
                  onClick={() => setShowUvGuide((v) => !v)}
                  title="Toggle UV guide"
                  aria-label="Toggle UV guide"
                >
                  {showUvGuide ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM))}
                  title="Zoom out"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM))}
                  title="Zoom in"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={13} />
                </button>
                <button type="button" onClick={fitView} title="Fit canvas" aria-label="Fit canvas">
                  <Maximize size={13} />
                </button>
              </div>

              <div className="pixelToolbarGroup">
                <button
                  type="button"
                  className={mirrorPaintX ? 'active' : ''}
                  onClick={() => setMirrorPaintX((v) => !v)}
                  title="Mirror paint X"
                  aria-label="Mirror paint X"
                >
                  <FlipHorizontal size={13} />
                </button>
                <button
                  type="button"
                  className={mirrorPaintY ? 'active' : ''}
                  onClick={() => setMirrorPaintY((v) => !v)}
                  title="Mirror paint Y"
                  aria-label="Mirror paint Y"
                >
                  <FlipVertical size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => flipActiveLayer('x')}
                  title="Flip layer X"
                  aria-label="Flip layer X"
                >
                  <FlipHorizontal size={13} />
                  <span className="pixelToolbarMini">F</span>
                </button>
                <button
                  type="button"
                  onClick={() => flipActiveLayer('y')}
                  title="Flip layer Y"
                  aria-label="Flip layer Y"
                >
                  <FlipVertical size={13} />
                  <span className="pixelToolbarMini">F</span>
                </button>
              </div>

              <div className="pixelToolbarGroup pixelToolbarGroup--grow">
                <button type="button" onClick={openNewImageDialog} title="New image">
                  New
                </button>
                <button type="button" onClick={() => fileRef.current?.click()} title="Import image">
                  <ImagePlus size={13} />
                </button>
                <button type="button" onClick={exportImage} title="Export image">
                  <Download size={13} />
                </button>
                <input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => loadImageFile(e.target.files?.[0])} />
                <span className="pixelToolbarDivider" aria-hidden="true" />
                <button
                  type="button"
                  onClick={doUndo}
                  disabled={undoStack.length === 0}
                  title="Undo (Ctrl+Z)"
                  aria-label="Undo"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  type="button"
                  onClick={doRedo}
                  disabled={redoStack.length === 0}
                  title="Redo (Ctrl+Y)"
                  aria-label="Redo"
                >
                  <Redo2 size={13} />
                </button>
                <button type="button" onClick={() => object && setObjectTexture(object.id, null)} title="Clear texture">
                  <Trash2 size={13} />
                </button>
                <button type="button" className="pixelToolbarPrimary" onClick={() => applyTexture(false)} title="Save texture">
                  <Save size={13} />
                </button>
              </div>
            </div>
          </div>

          <div className="pixelBody">
            <div className="pixelCanvasArea">
              <canvas
                ref={viewRef}
                className={`pixelCanvas pixelCanvas--${tool}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={handlePointerLeave}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
              />
              <div className="pixelStatusOverlay">
                <span>{activeTool.label}</span>
                <span>{Math.round(zoom * 100)}%</span>
                <span>{cursorPixel?.inside ? `${cursorPixel.x}, ${cursorPixel.y}` : 'outside'}</span>
              </div>
              {dragOver && <div className="uvDropOverlay">Drop image to import</div>}
            </div>

            <aside className="pixelSidePanel">
              <div className="pixelPanelSection">
                <h2>Palette</h2>
                <select value={paletteName} onChange={(e) => setPaletteName(e.target.value)}>
                  {Object.entries(PALETTES).map(([id, palette]) => (
                    <option key={id} value={id}>{palette.label}</option>
                  ))}
                </select>
                <div className="pixelSwatches">
                  {paletteColors.map((swatch, index) => (
                    <button
                      key={`${swatch}-${index}`}
                      type="button"
                      className={swatch === color ? 'active' : ''}
                      style={{ '--swatch': swatch }}
                      onClick={() => setActiveColor(swatch)}
                      title={swatch}
                      aria-label={`Use ${swatch}`}
                    />
                  ))}
                </div>
                <div className="pixelPaletteActions">
                  <button type="button" onClick={() => setCustomColors((current) => [color, ...current.filter((c) => c !== color)].slice(0, 32))}>
                    <Plus size={11} /> Color
                  </button>
                </div>
                {recentColors.length > 0 && (
                  <>
                    <h2>Recent</h2>
                    <div className="pixelSwatches pixelSwatches--recent">
                      {recentColors.slice(0, 8).map((swatch, index) => (
                        <button
                          key={`${swatch}-recent-${index}`}
                          type="button"
                          className={swatch === color ? 'active' : ''}
                          style={{ '--swatch': swatch }}
                          onClick={() => setActiveColor(swatch)}
                          title={swatch}
                          aria-label={`Use ${swatch}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="pixelPanelSection">
                <div className="pixelPanelHeader">
                  <h2>Layers</h2>
                  <div>
                    <button type="button" onClick={addLayer} title="Add layer" aria-label="Add layer"><Plus size={11} /></button>
                    <button type="button" onClick={duplicateLayer} title="Duplicate layer" aria-label="Duplicate layer"><Copy size={11} /></button>
                  </div>
                </div>
                <div className="pixelLayerList">
                  {[...layers].reverse().map((layer) => (
                    <div
                      key={layer.id}
                      className={[
                        'pixelLayer',
                        layer.id === activeLayerId ? 'active' : '',
                        draggingLayerId === layer.id ? 'dragging' : '',
                        dragOverLayerId === layer.id ? 'dragOver' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      draggable={layers.length > 1}
                      onDragStart={(e) => {
                        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) {
                          e.preventDefault();
                          return;
                        }
                        setDraggingLayerId(layer.id);
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', layer.id);
                      }}
                      onDragOver={(e) => {
                        if (!draggingLayerId || draggingLayerId === layer.id) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverLayerId(layer.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setDragOverLayerId((current) => (current === layer.id ? null : current));
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const sourceId = draggingLayerId || e.dataTransfer.getData('text/plain');
                        reorderLayersByDisplay(sourceId, layer.id);
                        setDragOverLayerId(null);
                        setDraggingLayerId(null);
                      }}
                      onDragEnd={() => {
                        setDragOverLayerId(null);
                        setDraggingLayerId(null);
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                        title="Toggle layer visibility"
                        aria-label="Toggle layer visibility"
                      >
                        {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                      <button type="button" className="pixelLayerName" onClick={() => setActiveLayerId(layer.id)}>
                        {layer.name}
                      </button>
                      <label className="pixelLayerOpacity" title="Layer opacity">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={Math.round(layer.opacity * 100)}
                          onChange={(e) =>
                            updateLayer(layer.id, {
                              opacity: clamp((Number(e.target.value) || 0) / 100, 0, 1),
                            })
                          }
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span>%</span>
                      </label>
                    </div>
                  ))}
                </div>
                <button type="button" className="pixelLayerDelete" onClick={deleteLayer} disabled={layers.length <= 1}>
                  <Trash2 size={11} /> Delete
                </button>
              </div>
              <div className="pixelPanelSection">
                <h2>Brush</h2>
                <label>Size <input type="range" min={1} max={64} value={brushSize} onChange={(e) => setPixelBrushSize(Number(e.target.value))} /></label>
                <label>Opacity <input type="range" min={0} max={100} value={Math.round(opacity * 100)} onChange={(e) => setPixelOpacity(Number(e.target.value) / 100)} /></label>
              </div>
              <div className="pixelPanelSection">
                <h2>View</h2>
                <label>Zoom <input type="range" min={20} max={4800} value={Math.round(zoom * 100)} onChange={(e) => setZoom(clamp(Number(e.target.value) / 100, MIN_ZOOM, MAX_ZOOM))} /></label>
                <p>{docSize.w} x {docSize.h}px</p>
              </div>
            </aside>
          </div>

          <div
            className="pixelResizeHandle"
            onPointerDown={beginResize}
            onPointerMove={moveResize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        </>
      )}

      {newImageDialogOpen && (
        <div className="pixelDialogBackdrop" onClick={() => setNewImageDialogOpen(false)}>
          <form
            className="pixelDialog"
            role="dialog"
            aria-labelledby="pixelNewImageTitle"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                setNewImageDialogOpen(false);
              }
            }}
            onSubmit={(e) => {
              e.preventDefault();
              confirmNewImage();
            }}
          >
            <h3 id="pixelNewImageTitle">New Image</h3>
            <label className="pixelDialogField">
              <span>Name</span>
              <input
                type="text"
                value={newImageDraft.name}
                autoFocus
                onChange={(e) => setNewImageDraft((draft) => ({ ...draft, name: e.target.value }))}
              />
            </label>
            <div className="pixelDialogSizeRow">
              <label className="pixelDialogField">
                <span>Width</span>
                <input
                  type="number"
                  min={MIN_IMAGE_SIZE}
                  max={MAX_IMAGE_SIZE}
                  value={newImageDraft.width}
                  onChange={(e) =>
                    setNewImageDraft((draft) => ({ ...draft, width: Number(e.target.value) || MIN_IMAGE_SIZE }))
                  }
                />
              </label>
              <label className="pixelDialogField">
                <span>Height</span>
                <input
                  type="number"
                  min={MIN_IMAGE_SIZE}
                  max={MAX_IMAGE_SIZE}
                  value={newImageDraft.height}
                  onChange={(e) =>
                    setNewImageDraft((draft) => ({ ...draft, height: Number(e.target.value) || MIN_IMAGE_SIZE }))
                  }
                />
              </label>
            </div>
            <label className="pixelDialogField">
              <span>Background</span>
              <input
                type="color"
                value={newImageDraft.background}
                disabled={newImageDraft.transparent}
                onChange={(e) => setNewImageDraft((draft) => ({ ...draft, background: e.target.value }))}
              />
            </label>
            <label className="pixelDialogField">
              <span>Background opacity</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={newImageDraft.transparent ? 0 : Math.round(newImageDraft.backgroundOpacity * 100)}
                disabled={newImageDraft.transparent}
                onChange={(e) =>
                  setNewImageDraft((draft) => ({
                    ...draft,
                    backgroundOpacity: clamp((Number(e.target.value) || 0) / 100, 0, 1),
                  }))
                }
              />
            </label>
            <label className="pixelDialogCheck">
              <input
                type="checkbox"
                checked={newImageDraft.transparent}
                onChange={(e) => setNewImageDraft((draft) => ({ ...draft, transparent: e.target.checked }))}
              />
              <span>Transparent</span>
            </label>
            <p className="pixelDialogHint">
              {MIN_IMAGE_SIZE}–{MAX_IMAGE_SIZE}px per side
            </p>
            {pixelDocHasContent() && (
              <p className="pixelDialogWarning">
                This replaces the current canvas, layers, and texture on the selected object.
              </p>
            )}
            <div className="pixelDialogActions">
              <button type="button" onClick={() => setNewImageDialogOpen(false)}>
                Cancel
              </button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

