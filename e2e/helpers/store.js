import { expect } from '@playwright/test';

export async function storeEval(page, fn) {
  return page.evaluate(fn);
}

export async function waitForStore(page) {
  await expect.poll(async () => {
    return page.evaluate(() => !!window.__pixaCadStore?.getState);
  }).toBe(true);
}

export async function seedCube(page) {
  await storeEval(page, () => {
    const store = window.__pixaCadStore.getState();
    store.addPrimitive('cube');
  });
}

export async function runPolyDrawTriangle(page) {
  await storeEval(page, () => {
    const store = window.__pixaCadStore.getState();
    store.setPolyFaceMode('tri');
    store.startPolyDraw();
    store.addPolyDrawPoint([0, 0, 0], 'top');
    store.addPolyDrawPoint([1, 0, 0], 'top');
    store.addPolyDrawPoint([0, 0, 1], 'top');
    store.finalizePolyDrawSession();
  });
}

export async function runKnifeHappyPath(page) {
  await storeEval(page, () => {
    const api = window.__pixaCadStore.getState();
    const obj = api.objects[0];
    if (!obj?.mesh) return;
    api.selectObject(obj.id);
    api.selectFace(0, 'replace');
    api.startKnifeTool();
    const face = obj.mesh.faces[0];
    const a = obj.mesh.getPosition(face[0]);
    const b = obj.mesh.getPosition(face[2] ?? face[1]);
    api.applyKnifePoint(obj.id, 0, a, face[0], a);
    api.applyKnifePoint(obj.id, 0, b, face[2] ?? face[1], b);
  });
}

export async function doStateRoundTrip(page) {
  await storeEval(page, () => {
    const api = window.__pixaCadStore.getState();
    const state = window.__pixaCadStore.getState();
    const snapshot = {
      objects: state.objects,
      selectedId: state.selectedId,
      editMode: state.editMode,
      transformMode: state.transformMode,
      showWireframe: state.showWireframe,
      showXRay: state.showXRay,
      showGrid: state.showGrid,
      snapGrid: state.snapGrid,
      gridSize: state.gridSize,
      paintColor: state.paintColor,
      renderMode: state.renderMode,
      viewportLayoutMode: state.viewportLayoutMode,
      themeId: state.themeId,
    };
    api.newScene();
    api.loadProjectState(snapshot);
  });
}

