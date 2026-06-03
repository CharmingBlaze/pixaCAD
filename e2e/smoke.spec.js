import { expect, test } from '@playwright/test';
import {
  doStateRoundTrip,
  runKnifeHappyPath,
  runPolyDrawTriangle,
  seedCube,
  storeEval,
  waitForStore,
} from './helpers/store.js';

test.describe('release smoke', () => {
  test('core workflows stay healthy', async ({ page }) => {
    const runtimeErrors = [];
    page.on('pageerror', (err) => runtimeErrors.push(String(err)));

    await page.goto('/');
    await waitForStore(page);
    await expect(page.getByTestId('app-root')).toBeVisible();
    await expect(page.getByTestId('status-primary')).toContainText('Ready');

    await seedCube(page);
    const objectCount = await storeEval(page, () => window.__pixaCadStore.getState().objects.length);
    expect(objectCount).toBeGreaterThan(0);

    await storeEval(page, () => {
      const api = window.__pixaCadStore.getState();
      const obj = api.objects[0];
      api.selectObject(obj.id);
      api.setEditMode('face');
      api.selectFace(0, 'replace');
      window.__extrudeUndoBaseline = obj.mesh.faceCount;
      api.startExtrudeSession();
      api.updateExtrudeDistance(0.5);
      api.confirmExtrudeSession();
    });
    await expect.poll(async () => {
      return page.evaluate(() => {
        const baseline = window.__extrudeUndoBaseline;
        const count = window.__pixaCadStore.getState().objects[0]?.mesh?.faceCount;
        return count > baseline;
      });
    }).toBe(true);
    await page.getByTestId('app-root').click();
    await page.keyboard.press('Control+Z');
    await expect.poll(async () => {
      return page.evaluate(() => {
        const baseline = window.__extrudeUndoBaseline;
        const count = window.__pixaCadStore.getState().objects[0]?.mesh?.faceCount;
        return count === baseline;
      });
    }).toBe(true);

    await page.getByTestId('tool-edit-face').click();
    await storeEval(page, () => {
      const api = window.__pixaCadStore.getState();
      const first = api.objects[0];
      if (!first?.mesh) return;
      api.selectObject(first.id);
      api.setEditMode('face');
      api.selectFace(0, 'replace');
    });
    await expect.poll(async () => page.evaluate(() => window.__pixaCadStore.getState().editMode)).toBe('face');
    await page.getByTestId('face-color-input').first().fill('#ff0066');
    await expect(page.getByTestId('status-primary')).toContainText('painted');

    await runPolyDrawTriangle(page);
    await expect.poll(async () => {
      return page.evaluate(() => {
        const s = window.__pixaCadStore.getState();
        return { activeTool: s.activeTool, polyDrawActive: s.polyDrawActive, objects: s.objects.length };
      });
    }).toEqual(
      expect.objectContaining({
        activeTool: 'select',
        polyDrawActive: false,
      }),
    );

    await runKnifeHappyPath(page);
    await expect(page.getByTestId('status-primary')).toContainText('Face cut');

    await doStateRoundTrip(page);
    await expect.poll(async () => {
      return page.evaluate(() => window.__pixaCadStore.getState().objects.length);
    }).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'UV Editor' }).click();
    await expect.poll(async () => page.evaluate(() => window.__pixaCadStore.getState().uvEditorOpen)).toBe(true);

    await page.getByRole('button', { name: 'Pixel Draw' }).click();
    await expect.poll(async () => page.evaluate(() => window.__pixaCadStore.getState().pixelEditorOpen)).toBe(true);

    expect(runtimeErrors, `runtime errors: ${runtimeErrors.join('\n')}`).toEqual([]);
  });
});

