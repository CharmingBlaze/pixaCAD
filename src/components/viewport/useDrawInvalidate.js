import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore.js';

/** Force R3F to repaint when editor state changes (covers demand frameloop edge cases). */
export function useDrawInvalidate() {
  const invalidate = useThree((s) => s.invalidate);
  const drawRevision = useEditorStore((s) => s.drawRevision);
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const objects = useEditorStore((s) => s.objects);
  const selectedId = useEditorStore((s) => s.selectedId);
  const editMode = useEditorStore((s) => s.editMode);
  const transformMode = useEditorStore((s) => s.transformMode);
  const selectedVertices = useEditorStore((s) => s.selectedVertices);
  const selectedEdges = useEditorStore((s) => s.selectedEdges);
  const selectedFaces = useEditorStore((s) => s.selectedFaces);
  const hoveredVertex = useEditorStore((s) => s.hoveredVertex);
  const hoveredEdge = useEditorStore((s) => s.hoveredEdge);
  const hoveredFace = useEditorStore((s) => s.hoveredFace);
  const polyDrawVerts = useEditorStore((s) => s.polyDrawVerts);
  const activeTool = useEditorStore((s) => s.activeTool);
  const renderMode = useEditorStore((s) => s.renderMode);
  const showWireframe = useEditorStore((s) => s.showWireframe);
  const showXRay = useEditorStore((s) => s.showXRay);
  const loopCutFactor = useEditorStore((s) => s.loopCutFactor);
  const loopCutCuts = useEditorStore((s) => s.loopCutCuts);
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const bevelAmount = useEditorStore((s) => s.bevelAmount);
  const bevelSegments = useEditorStore((s) => s.bevelSegments);
  const bevelActive = useEditorStore((s) => s.bevelActive);

  useEffect(() => {
    invalidate();
  }, [
    drawRevision,
    meshRevision,
    objects,
    selectedId,
    editMode,
    transformMode,
    selectedVertices,
    selectedEdges,
    selectedFaces,
    hoveredVertex,
    hoveredEdge,
    hoveredFace,
    polyDrawVerts,
    activeTool,
    renderMode,
    showWireframe,
    showXRay,
    loopCutFactor,
    loopCutCuts,
    loopCutActive,
    bevelAmount,
    bevelSegments,
    bevelActive,
    invalidate,
  ]);
}

