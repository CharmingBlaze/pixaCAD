import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';

/** Applies theme to document root for body/html outside .khedApp. */
export function useThemeDocumentSync() {
  const themeId = useEditorStore((s) => s.themeId);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;

    // Drop focus/hover so buttons repaint with the new theme tokens (avoids stale colors).
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [themeId]);
}
