import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';

/** Warn on tab close when the scene has unsaved edits. */
export function useSceneDirtyGuard() {
  const sceneDirty = useEditorStore((s) => s.sceneDirty);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!useEditorStore.getState().sceneDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [sceneDirty]);
}
