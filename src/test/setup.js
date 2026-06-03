/** Vitest setup — extend as needed for DOM/canvas mocks. */

if (typeof FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    result = '';
    /** @type {(() => void) | null} */
    onload = null;

    /** @param {File} file */
    readAsText(file) {
      file.text().then((text) => {
        this.result = text;
        this.onload?.({ target: this });
      });
    }
  };
}
