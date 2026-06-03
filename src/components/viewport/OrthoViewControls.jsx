import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ORTHO_VIEW_SETUP } from './orthoViewSetup.js';

/**
 * @param {{ view: import('./orthoViewSetup.js').OrthoViewId, enabled?: boolean }} props
 */
export function OrthoViewControls({ view, enabled = true }) {
  const { camera } = useThree();
  const controlsRef = useRef(/** @type {import('three-stdlib').OrbitControls | null} */ (null));
  const setup = ORTHO_VIEW_SETUP[view];

  const applyFrame = () => {
    camera.position.set(...setup.position);
    camera.up.set(...setup.up);
    camera.lookAt(0, 0, 0);
    if (camera instanceof THREE.OrthographicCamera) {
      if (!camera.zoom) camera.zoom = 48;
      camera.updateProjectionMatrix();
    }
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.set(0, 0, 0);
      ctrl.update();
    }
  };

  useEffect(() => {
    applyFrame();
  }, [view, camera, setup]);

  // Keep front/top/right from flipping after pan/zoom.
  useFrame(() => {
    if (!enabled) return;
    camera.up.set(...setup.up);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={enabled}
      enableRotate={false}
      enableDamping={false}
      screenSpacePanning
      zoomToCursor
      zoomSpeed={1.1}
      panSpeed={1.2}
      minZoom={8}
      maxZoom={240}
      mouseButtons={{
        LEFT: null,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: null,
      }}
      touches={{
        ONE: THREE.TOUCH.PAN,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
    />
  );
}
