import { useEffect, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { buildMeshOutlineGeometry } from '../lib/mesh/faceGeometry.js';

/**
 * Buffer geometry for a scene object mesh; updates when mesh data or global revision changes.
 * During interactive vertex drag, position attributes are patched in place instead of rebuilding.
 * @param {import('../store/editorStore.js').SceneObject | null | undefined} object
 */
export function useMeshGeometry(object) {
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const interactiveMeshTick = useEditorStore((s) => s.interactiveMeshTick);

  const geometry = useMemo(() => {
    if (!object?.mesh) return null;
    return object.mesh.toBufferGeometry();
  }, [object?.mesh, object?.id, meshRevision]);

  useEffect(() => {
    if (!object?.mesh || !geometry || interactiveMeshTick === 0) return;
    object.mesh.updateBufferGeometryPositions(geometry);
  }, [interactiveMeshTick, object?.mesh, object?.id, geometry]);

  return geometry;
}

/**
 * Dispose generated geometries when an object mesh changes or a viewport unmounts.
 * R3F does not own these memoized geometries because they are created outside JSX.
 */
export function useDisposableMeshGeometry(object) {
  const geometry = useMeshGeometry(object);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return geometry;
}

/**
 * Quad/ngon edge outline geometry (Blockbench-style, no triangulation diagonals).
 * @param {import('../store/editorStore.js').SceneObject | null | undefined} object
 */
export function useMeshOutlineGeometry(object) {
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const interactiveMeshTick = useEditorStore((s) => s.interactiveMeshTick);

  const geometry = useMemo(() => {
    if (!object?.mesh) return null;
    return buildMeshOutlineGeometry(object.mesh);
  }, [object?.mesh, object?.id, meshRevision]);

  useEffect(() => {
    if (!object?.mesh || !geometry || interactiveMeshTick === 0) return;
    const posAttr = geometry.getAttribute('position');
    if (!posAttr) return;
    const arr = posAttr.array;
    let offset = 0;
    for (const face of object.mesh.faces) {
      for (let i = 0; i < face.length; i++) {
        for (const vi of [face[i], face[(i + 1) % face.length]]) {
          const p = object.mesh.getPosition(vi);
          arr[offset++] = p[0];
          arr[offset++] = p[1];
          arr[offset++] = p[2];
        }
      }
    }
    posAttr.needsUpdate = true;
  }, [interactiveMeshTick, object?.mesh, object?.id, geometry]);

  return geometry;
}

/**
 * @param {import('../store/editorStore.js').SceneObject | null | undefined} object
 */
export function useDisposableMeshOutlineGeometry(object) {
  const geometry = useMeshOutlineGeometry(object);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  return geometry;
}
