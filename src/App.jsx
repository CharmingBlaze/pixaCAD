import { lazy, Suspense, useEffect } from 'react';
import { MenuBar } from './components/layout/MenuBar.jsx';
import { ToolPalette } from './components/layout/ToolPalette.jsx';
import { StatusBar } from './components/layout/StatusBar.jsx';
import { Viewport } from './components/viewport/Viewport.jsx';
import { PropertiesPanel } from './components/panels/PropertiesPanel.jsx';
import { ScenePanel } from './components/panels/ScenePanel.jsx';
import { MaterialPropertiesPanel } from './components/panels/MaterialPropertiesPanel.jsx';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useSceneDirtyGuard } from './hooks/useSceneDirtyGuard.js';
import { useThemeDocumentSync } from './hooks/useThemeDocumentSync.js';
import { useThemeMaterialSync } from './hooks/useThemeMaterialSync.js';
import { ConfirmDialog } from './components/ConfirmDialog.jsx';
import { useEditorStore } from './store/editorStore.js';
import { projectSnapshot } from './export/project.js';
import { scheduleAutosave } from './lib/autosave/projectAutosave.js';

const UVEditorWindow = lazy(() =>
  import('./components/uv/UVEditorWindow.jsx').then((module) => ({ default: module.UVEditorWindow })),
);
const PixelEditorWindow = lazy(() =>
  import('./components/pixel/PixelEditorWindow.jsx').then((module) => ({ default: module.PixelEditorWindow })),
);

export function App() {
  useKeyboardShortcuts();
  useSceneDirtyGuard();
  useThemeDocumentSync();
  useThemeMaterialSync();
  const themeId = useEditorStore((s) => s.themeId);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Expose store for deterministic end-to-end smoke tests.
    window.__pixaCadStore = useEditorStore;
    window.__khedStore = useEditorStore;
    const stopAutosave = scheduleAutosave(() => projectSnapshot(useEditorStore.getState()));
    return () => {
      delete window.__pixaCadStore;
      delete window.__khedStore;
      stopAutosave();
    };
  }, []);

  return (
    <div className="khedApp" data-theme={themeId} data-testid="app-root">
      <MenuBar />
      <div className="khedWorkspace">
        <ToolPalette key={themeId} />
        <Viewport />
        <div className="khedRight">
          <ScenePanel />
          <MaterialPropertiesPanel />
          <PropertiesPanel />
        </div>
      </div>
      <StatusBar />
      <Suspense fallback={null}>
        <UVEditorWindow />
        <PixelEditorWindow />
      </Suspense>
      <ConfirmDialog />
    </div>
  );
}
