import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { getThemeMaterialDefault } from '../lib/themeMaterial.js';

/** Syncs Material paint swatch to --t-material-default when the UI theme changes. */
export function useThemeMaterialSync() {
  const themeId = useEditorStore((s) => s.themeId);
  const setPaintColor = useEditorStore((s) => s.setPaintColor);

  useEffect(() => {
    const apply = () => setPaintColor(getThemeMaterialDefault());
    apply();
    const id = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(id);
  }, [themeId, setPaintColor]);
}
