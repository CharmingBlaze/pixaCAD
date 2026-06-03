import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadAutosaveProject,
  saveAutosaveProject,
  scheduleAutosave,
} from './projectAutosave.js';

function createIndexedDbMock() {
  /** @type {Map<string, Map<string, unknown>>} */
  const databases = new Map();

  const openDb = (name) => {
    if (!databases.has(name)) databases.set(name, new Map());
    const store = databases.get(name);
    return {
      objectStoreNames: { contains: () => true },
      transaction: () => {
        const tx = {
          oncomplete: null,
          onerror: null,
          objectStore: () => ({
            put: (value) => {
              store.set(value.id, value);
            },
            get: (key) => {
              const req = {
                onsuccess: null,
                onerror: null,
                result: store.get(key),
              };
              queueMicrotask(() => req.onsuccess?.({ target: req }));
              return req;
            },
          }),
        };
        queueMicrotask(() => tx.oncomplete?.());
        return tx;
      },
      close: () => {},
    };
  };

  return {
    open: (name) => {
      const req = {
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        result: openDb(name),
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
    _store: databases,
  };
}

describe('projectAutosave', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', createIndexedDbMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads a project snapshot', async () => {
    const project = { version: 1, objects: [{ id: 'a', name: 'Cube' }] };
    await saveAutosaveProject('test-id', project, 'Test');
    const loaded = await loadAutosaveProject('test-id');
    expect(loaded?.project).toEqual(project);
    expect(loaded?.label).toBe('Test');
  });

  it('reports autosave failures via onError', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('IDB unavailable');
      },
    });
    const errors = [];
    const stop = scheduleAutosave(() => ({}), 10, (err) => errors.push(err));
    await vi.advanceTimersByTimeAsync(15);
    stop();
    vi.useRealTimers();
    expect(errors.length).toBeGreaterThan(0);
  });
});
