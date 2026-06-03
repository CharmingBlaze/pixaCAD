import { blobToBase64, getDesktopApp, isDesktopApp } from '../lib/desktop.js';

export function safeName(name, fallback = 'asset') {
  return String(name || fallback)
    .trim()
    .replace(/[^a-z0-9._-]+/gi, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

export function dataUrlToBlob(dataUrl) {
  const [header, data] = String(dataUrl).split(',');
  const mime = header.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bytes = atob(data ?? '');
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i);
  return new Blob([out], { type: mime });
}

export async function saveBlob(blob, filename, description = 'File') {
  const desktop = getDesktopApp();
  if (isDesktopApp() && desktop) {
    const base64 = await blobToBase64(blob);
    const path = await desktop.SaveBinaryFile(filename, base64, description);
    if (path) return;
    return;
  }

  if ('showSaveFilePicker' in window) {
    try {
      const ext = filename.includes('.') ? `.${filename.split('.').pop()}` : '';
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept: { [blob.type || 'application/octet-stream']: ext ? [ext] : [] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveText(text, filename, type = 'text/plain') {
  return saveBlob(new Blob([text], { type }), filename, 'Text file');
}

/** @param {{ name: string, blob: Blob }[]} files @param {string} [folderName] */
export async function saveFiles(files, folderName = 'export') {
  const desktop = getDesktopApp();
  if (isDesktopApp() && desktop) {
    const payload = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        data: await blobToBase64(file.blob),
      })),
    );
    const dir = await desktop.ExportFiles(payload);
    if (dir) return;
    return;
  }

  if ('showDirectoryPicker' in window) {
    try {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite', suggestedName: folderName });
      for (const file of files) {
        const handle = await dir.getFileHandle(file.name, { create: true });
        const writable = await handle.createWritable();
        await writable.write(file.blob);
        await writable.close();
      }
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }

  for (const file of files) await saveBlob(file.blob, file.name);
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function readFileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** @param {string} text @param {string} filename @param {string} [dialogTitle] @returns {Promise<string | null>} saved path or null if cancelled */
export async function saveTextNative(text, filename, dialogTitle = 'Save file') {
  const desktop = getDesktopApp();
  if (isDesktopApp() && desktop) {
    const path = await desktop.SaveTextFile(filename, text, dialogTitle);
    return path || null;
  }
  await saveText(text, filename);
  return filename;
}

/** @param {string} [dialogTitle] @returns {Promise<string | null>} */
export async function openTextNative(dialogTitle = 'Open file') {
  const desktop = getDesktopApp();
  if (!isDesktopApp() || !desktop) return null;
  const text = await desktop.OpenTextFile(dialogTitle);
  return text || null;
}
