import { useRef } from 'react';
import { useEditorStore } from '../../store/editorStore.js';
import { importOBJFiles } from '../../export/obj.js';
import { importGLTFFiles } from '../../export/gltf.js';
import { loadProjectFile, loadProjectFromDesktop, saveProject } from '../../export/project.js';
import { confirmDiscardChanges } from '../../lib/confirmDiscard.js';
import { isDesktopApp } from '../../lib/desktop.js';
import { BRAND_NAME, PROJECT_FILE_ACCEPT } from '../../lib/brand.js';
import { THEMES } from '../../lib/themes.js';
import { HelpMenu } from './HelpMenu.jsx';

export function MenuBar() {
  const projectInputRef = useRef(null);
  const objInputRef = useRef(null);
  const gltfInputRef = useRef(null);
  const objects = useEditorStore((s) => s.objects);
  const newScene = useEditorStore((s) => s.newScene);
  const sceneDirty = useEditorStore((s) => s.sceneDirty);
  const markSceneSaved = useEditorStore((s) => s.markSceneSaved);
  const loadProjectState = useEditorStore((s) => s.loadProjectState);
  const importSceneObjects = useEditorStore((s) => s.importSceneObjects);
  const setStatus = useEditorStore((s) => s.setStatus);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const duplicateSelected = useEditorStore((s) => s.duplicateSelected);
  const copySelectedObject = useEditorStore((s) => s.copySelectedObject);
  const pasteClipboardObject = useEditorStore((s) => s.pasteClipboardObject);
  const objectClipboard = useEditorStore((s) => s.objectClipboard);
  const weldSelection = useEditorStore((s) => s.weldSelection);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo);
  const canRedo = useEditorStore((s) => s.canRedo);
  const toggleWireframe = useEditorStore((s) => s.toggleWireframe);
  const showNormals = useEditorStore((s) => s.showNormals);
  const toggleNormals = useEditorStore((s) => s.toggleNormals);
  const toggleXRay = useEditorStore((s) => s.toggleXRay);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const renderMode = useEditorStore((s) => s.renderMode);
  const setRenderMode = useEditorStore((s) => s.setRenderMode);
  const viewportLayoutMode = useEditorStore((s) => s.viewportLayoutMode);
  const setViewportLayoutMode = useEditorStore((s) => s.setViewportLayoutMode);
  const centerActiveViewport = useEditorStore((s) => s.centerActiveViewport);
  const resetActiveViewport = useEditorStore((s) => s.resetActiveViewport);
  const resetAllViewports = useEditorStore((s) => s.resetAllViewports);
  const themeId = useEditorStore((s) => s.themeId);
  const setTheme = useEditorStore((s) => s.setTheme);
  const openPixelEditor = useEditorStore((s) => s.openPixelEditor);
  const openUvEditor = useEditorStore((s) => s.openUvEditor);

  const handleSaveProject = async () => {
    try {
      const state = useEditorStore.getState();
      await saveProject(state);
      await state.persistAutosave?.();
      markSceneSaved();
      setStatus('Project saved');
    } catch (err) {
      setStatus(`Project save failed: ${err.message}`);
    }
  };
  const handleOpenProject = async () => {
    if (!(await confirmDiscardChanges(sceneDirty))) return;
    try {
      if (isDesktopApp()) {
        const project = await loadProjectFromDesktop();
        if (project) {
          loadProjectState(project);
          setStatus('Project loaded');
        }
        return;
      }
      projectInputRef.current?.click();
    } catch (err) {
      setStatus(`Project load failed: ${err.message}`);
    }
  };
  const openRecentProject = useEditorStore((s) => s.openRecentProject);
  const handleLoadProject = async (file) => {
    if (!file) return;
    if (!(await confirmDiscardChanges(sceneDirty))) return;
    try {
      loadProjectState(await loadProjectFile(file));
    } catch (err) {
      setStatus(`Project load failed: ${err.message}`);
    }
  };
  const handleNewScene = async () => {
    if (!(await confirmDiscardChanges(sceneDirty))) return;
    newScene();
  };
  const handleOBJImport = async (files) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    try {
      importSceneObjects(await importOBJFiles(list));
    } catch (err) {
      setStatus(`OBJ import failed: ${err.message}`);
    }
  };
  const handleGLTFImport = async (files) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;
    try {
      importSceneObjects(await importGLTFFiles(list));
    } catch (err) {
      setStatus(`GLTF import failed: ${err.message}`);
    }
  };
  const handleOBJExport = async () => {
    try {
      const { exportSceneToOBJ } = await import('../../export/obj.js');
      await exportSceneToOBJ(objects);
      setStatus('OBJ exported');
    } catch (err) {
      setStatus(`OBJ export failed: ${err.message}`);
    }
  };
  const handleGLTFExport = async () => {
    try {
      const { exportSceneToGLTF } = await import('../../export/gltf.js');
      await exportSceneToGLTF(objects);
      setStatus('GLTF exported');
    } catch (err) {
      setStatus(`GLTF export failed: ${err.message}`);
    }
  };
  const handleGLBExport = async () => {
    try {
      const { exportSceneToGLB } = await import('../../export/gltf.js');
      await exportSceneToGLB(objects);
      setStatus('GLB exported');
    } catch (err) {
      setStatus(`GLB export failed: ${err.message}`);
    }
  };
  const handleSTLExport = async () => {
    try {
      const { exportSceneToSTL } = await import('../../export/stl.js');
      await exportSceneToSTL(objects);
      setStatus('STL exported');
    } catch (err) {
      setStatus(`STL export failed: ${err.message}`);
    }
  };

  return (
    <header className="menuBar">
      <div className="brand">{BRAND_NAME}</div>
      <nav className="menuNav">
        <div className="menuGroup">
          <span className="menuLabel">File</span>
          <div className="menuDropdown">
            <button type="button" onClick={handleNewScene} data-testid="menu-file-new">
              New
            </button>
            <button type="button" onClick={handleSaveProject} data-testid="menu-file-save-project">
              Save Project
            </button>
            <button
              type="button"
              onClick={() => void handleOpenProject()}
              data-testid="menu-file-load-project"
            >
              Load Project
            </button>
            <button type="button" onClick={() => objInputRef.current?.click()}>
              Import OBJ
            </button>
            <button type="button" onClick={() => gltfInputRef.current?.click()}>
              Import GLTF
            </button>
            <button type="button" onClick={handleOBJExport}>
              Export OBJ
            </button>
            <button type="button" onClick={handleGLTFExport}>
              Export GLTF
            </button>
            <button type="button" onClick={handleGLBExport}>
              Export GLB
            </button>
            <button type="button" onClick={handleSTLExport}>
              Export STL
            </button>
            <button type="button" onClick={openRecentProject}>
              Open Recent
            </button>
            <input
              ref={projectInputRef}
              data-testid="input-load-project"
              hidden
              type="file"
              accept={PROJECT_FILE_ACCEPT}
              onChange={(e) => {
                handleLoadProject(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <input
              ref={objInputRef}
              hidden
              multiple
              type="file"
              accept=".obj,.mtl,image/*"
              onChange={(e) => {
                handleOBJImport(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={gltfInputRef}
              hidden
              multiple
              type="file"
              accept=".gltf,.glb,.bin,image/*"
              onChange={(e) => {
                handleGLTFImport(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        <div className="menuGroup">
          <span className="menuLabel">Edit</span>
          <div className="menuDropdown">
            <button type="button" onClick={undo} disabled={!canUndo}>
              Undo
            </button>
            <button type="button" onClick={redo} disabled={!canRedo}>
              Redo
            </button>
            <div className="menuDivider" role="separator" />
            <button type="button" onClick={copySelectedObject}>
              Copy
            </button>
            <button type="button" onClick={pasteClipboardObject} disabled={!objectClipboard}>
              Paste
            </button>
            <button type="button" onClick={duplicateSelected}>
              Duplicate
            </button>
            <button type="button" onClick={removeSelected}>
              Delete
            </button>
            <button type="button" onClick={weldSelection}>
              Weld Vertices
            </button>
          </div>
        </div>
        <div className="menuGroup">
          <span className="menuLabel">View</span>
          <div className="menuDropdown">
            <button type="button" onClick={toggleWireframe}>
              Toggle Wireframe
            </button>
            <button type="button" onClick={toggleNormals}>
              {showNormals ? '✓ ' : ''}Show Normals
            </button>
            <button type="button" onClick={toggleXRay}>
              Toggle X-Ray
            </button>
            <button type="button" onClick={toggleGrid}>
              Toggle Grid
            </button>
          </div>
        </div>
        <div className="menuGroup">
          <span className="menuLabel">Viewport</span>
          <div className="menuDropdown">
            <button type="button" onClick={() => setRenderMode('solid')}>
              {renderMode === 'solid' ? '✓ ' : ''}Solid Shading
            </button>
            <button type="button" onClick={() => setRenderMode('textured')}>
              {renderMode === 'textured' ? '✓ ' : ''}Shading + Textures
            </button>
            <button type="button" onClick={() => setRenderMode('wireframe')}>
              {renderMode === 'wireframe' ? '✓ ' : ''}Wireframe
            </button>
            <button type="button" onClick={() => setRenderMode('outline')}>
              {renderMode === 'outline' ? '✓ ' : ''}Outline Shading
            </button>
            <button type="button" onClick={() => setViewportLayoutMode('quad')}>
              {viewportLayoutMode === 'quad' ? '✓ ' : ''}Quad (2x2)
            </button>
            <button type="button" onClick={() => setViewportLayoutMode('single')}>
              {viewportLayoutMode === 'single' ? '✓ ' : ''}Single (1x1)
            </button>
            <button type="button" onClick={() => setViewportLayoutMode('splitVertical')}>
              {viewportLayoutMode === 'splitVertical' ? '✓ ' : ''}Vertical Split (1x2)
            </button>
            <button type="button" onClick={() => setViewportLayoutMode('splitHorizontal')}>
              {viewportLayoutMode === 'splitHorizontal' ? '✓ ' : ''}Horizontal Split (2x1)
            </button>
            <div className="menuDivider" role="separator" />
            <button type="button" onClick={() => centerActiveViewport('selection')}>
              Center View on Selection
            </button>
            <button type="button" onClick={() => centerActiveViewport('scene')}>
              Center View on Scene
            </button>
            <button type="button" onClick={resetActiveViewport}>
              Reset Active Viewport
            </button>
            <button type="button" onClick={resetAllViewports}>
              Reset All Viewports
            </button>
          </div>
        </div>
        <HelpMenu />
        <div className="menuGroup">
          <span className="menuLabel">Theme</span>
          <div className="menuDropdown menuDropdown--themes">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="menuThemeItem"
                onClick={() => setTheme(theme.id)}
              >
                <span className="menuThemeCheck" aria-hidden>
                  {themeId === theme.id ? '✓' : ''}
                </span>
                {theme.label}
              </button>
            ))}
          </div>
        </div>
      </nav>
      <div className="menuQuickActions">
        <button type="button" className="menuQuickBtn" onClick={openUvEditor}>
          UV Editor
        </button>
        <button type="button" className="menuQuickBtn" onClick={openPixelEditor}>
          Pixel Draw
        </button>
      </div>
    </header>
  );
}
