import { useMemo } from 'react';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore } from '../../store/editorStore.js';
import { buildChildrenMap, getRootObjects } from '../../lib/scene/sceneTree.js';
import { useViewportTheme } from '../../hooks/useViewportTheme.js';
import { SceneObject } from './SceneObject.jsx';
import { OrthoViewControls } from './OrthoViewControls.jsx';
import { ViewportGrid } from './ViewportGrid.jsx';
import { DrawBoxPreview } from './DrawBoxPreview.jsx';
import { PrimitiveDrawTool } from './PrimitiveDrawTool.jsx';
import { PolyDrawTool } from './PolyDrawTool.jsx';
import { ExtrudeTool } from './ExtrudeTool.jsx';
import { LoopCutTool } from './LoopCutTool.jsx';
import { BevelTool } from './BevelTool.jsx';
import { KnifeTool } from './KnifeTool.jsx';
import { VertexModeInteraction } from './vertex/VertexModeInteraction.jsx';
import { ViewportCameraBridge } from './ViewportCameraBridge.jsx';
import { ViewportAxes } from './ViewportAxes.jsx';
import { ObjectSelectionTransformControls } from './ObjectSelectionTransformControls.jsx';
import { OrbitControlsRecovery } from './OrbitControlsRecovery.jsx';
import { useDrawInvalidate } from './useDrawInvalidate.js';

/**
 * @param {{
 *   viewId: import('./viewportConfig.js').ViewportId,
 *   enableGizmos?: boolean,
 *   showOrientationGizmo?: boolean,
 *   orthoView?: import('./orthoViewSetup.js').OrthoViewId | null,
 *   slotId: string,
 * }} props
 */
export function SceneContent({
  slotId,
  viewId,
  enableGizmos = false,
  showOrientationGizmo = false,
  orthoView = null,
}) {
  const objects = useEditorStore((s) => s.objects);
  const childrenByParent = useMemo(() => buildChildrenMap(objects), [objects]);
  const rootObjects = useMemo(() => getRootObjects(objects), [objects]);
  const selectedId = useEditorStore((s) => s.selectedId);
  const editMode = useEditorStore((s) => s.editMode);
  const showGrid = useEditorStore((s) => s.showGrid);
  const renderMode = useEditorStore((s) => s.renderMode);
  const pendingPrimitive = useEditorStore((s) => s.pendingPrimitive);
  const polyDrawActive = useEditorStore((s) => s.polyDrawActive);
  const extrudeActive = useEditorStore((s) => s.extrudeActive);
  const loopCutActive = useEditorStore((s) => s.loopCutActive);
  const bevelActive = useEditorStore((s) => s.bevelActive);
  const knifeActive = useEditorStore((s) => s.knifeActive);
  const interactiveTransformActive = useEditorStore((s) => s.interactiveTransformActive);
  const vertexManipActive = useEditorStore((s) => s.vertexManipActive);
  const vertexManipSession = useEditorStore((s) => s.vertexManipSession);
  const marqueeActive = useEditorStore((s) => s.marqueeActive);
  const drawPhase = useEditorStore((s) => s.drawPhase);
  const drawViewId = useEditorStore((s) => s.drawViewId);
  const isDrawingHere =
    (drawViewId === viewId && drawPhase !== 'idle') ||
    extrudeActive ||
    loopCutActive ||
    bevelActive ||
    knifeActive ||
    interactiveTransformActive ||
    (vertexManipActive && vertexManipSession) ||
    marqueeActive;
  const blockGizmos =
    pendingPrimitive || polyDrawActive || extrudeActive || loopCutActive || bevelActive || knifeActive;
  const showDrawPreview = !!pendingPrimitive && drawPhase !== 'idle';

  const vpTheme = useViewportTheme();
  const selected = objects.find((o) => o.id === selectedId);

  useDrawInvalidate();

  return (
    <>
      <color attach="background" args={[vpTheme.background]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 10, 6]} intensity={0.85} />
      <directionalLight position={[-4, 3, -2]} intensity={0.25} />

      {showGrid && <ViewportGrid orthoView={orthoView} />}

      {orthoView ? <ViewportAxes orthoView={orthoView} /> : <axesHelper args={[2]} />}

      {rootObjects.map((obj) => (
        <SceneObject
          key={obj.id}
          object={obj}
          viewId={viewId}
          enableGizmos={enableGizmos && !blockGizmos}
          flatLit={!!orthoView}
          renderMode={renderMode}
          childrenByParent={childrenByParent}
          sceneObjects={objects}
        />
      ))}

      <ObjectSelectionTransformControls enabled={enableGizmos && !blockGizmos} />

      {showDrawPreview && <DrawBoxPreview viewId={viewId} />}
      <PrimitiveDrawTool viewId={viewId} orthoView={orthoView} />
      <PolyDrawTool viewId={viewId} orthoView={orthoView} />
      <ExtrudeTool />
      <LoopCutTool />
      <BevelTool />
      <KnifeTool viewId={viewId} />
      <VertexModeInteraction viewId={viewId} />
      <ViewportCameraBridge slotId={slotId} viewId={viewId} />
      <OrbitControlsRecovery orbitEnabled={!isDrawingHere} />

      {orthoView ? (
        <OrthoViewControls view={orthoView} enabled={!isDrawingHere} />
      ) : (
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          enabled={!isDrawingHere}
          mouseButtons={{
            LEFT: null,
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      )}

      {showOrientationGizmo && !blockGizmos && (
        <GizmoHelper alignment="bottom-right" margin={[56, 56]}>
          <GizmoViewport
            axisColors={[vpTheme.axisX, vpTheme.axisY, vpTheme.axisZ]}
            labelColor={vpTheme.axisPrimary}
          />
        </GizmoHelper>
      )}
    </>
  );
}
