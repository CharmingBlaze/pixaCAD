const DB_NAME = 'pixacad-autosave';
const STORE = 'projects';
const RECENT_KEY = 'recent';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** @param {string} id @param {unknown} project @param {string} label */
export async function saveAutosaveProject(id, project, label) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({
      id,
      label,
      savedAt: new Date().toISOString(),
      project,
    });
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  await addRecentProject(id, label);
}

/** @returns {Promise<Array<{ id: string, label: string, savedAt: string }>>} */
export async function listRecentProjects() {
  const db = await openDb();
  const recent = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(RECENT_KEY);
    req.onsuccess = () => resolve(req.result?.items ?? []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return recent;
}

/** @param {string} id @param {string} label */
async function addRecentProject(id, label) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req = store.get(RECENT_KEY);
    req.onsuccess = () => {
      const prev = req.result?.items ?? [];
      const next = [{ id, label, savedAt: new Date().toISOString() }, ...prev.filter((x) => x.id !== id)].slice(0, 8);
      store.put({ id: RECENT_KEY, items: next });
    };
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** @param {string} id */
export async function loadAutosaveProject(id) {
  const db = await openDb();
  const entry = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return entry;
}

/** @param {() => unknown} getSnapshot @param {number} [intervalMs] */
export function scheduleAutosave(getSnapshot, intervalMs = 120000) {
  if (typeof indexedDB === 'undefined') return () => {};
  const id = 'autosave-current';
  const timer = window.setInterval(async () => {
    try {
      await saveAutosaveProject(id, getSnapshot(), 'Autosave');
    } catch {
      /* ignore autosave failures */
    }
  }, intervalMs);
  return () => window.clearInterval(timer);
}
