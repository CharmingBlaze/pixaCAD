/** @returns {boolean} */
export function isDesktopApp() {
  return typeof window !== 'undefined' && typeof window.runtime !== 'undefined';
}

/** @returns {import('../../wailsjs/go/main/App').App | null} */
export function getDesktopApp() {
  if (!isDesktopApp()) return null;
  return window.go?.main?.App ?? null;
}

/** @param {Blob} blob */
export async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
