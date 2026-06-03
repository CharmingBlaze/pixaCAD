import { useEffect, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { buildMeshOutlineGeometry } from '../lib/mesh/faceGeometry.js';

/**
 * Buffer geometry for a scene object mesh; updates when mesh data or global revision changes.
 * @param {import('../store/editorStore.js').SceneObject | null | undefined} object
 */
export function useMeshGeometry(object) {
  const meshRevision = useEditorStore((s) => s.meshRevision);
  const interactiveMeshTick = useEditorStore((s) => s.interactiveMeshTick);

  return useMemo(() => {
    if (!object?.mesh) return null;
    return object.mesh.toBufferGeometry();
  }, [object?.mesh, object?.id, meshRevision, interactiveMeshTick]);
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

  return useMemo(() => {
    if (!object?.mesh) return null;
    return buildMeshOutlineGeometry(object.mesh);
  }, [object?.mesh, object?.id, meshRevision, interactiveMeshTick]);
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
