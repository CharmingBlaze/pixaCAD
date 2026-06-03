import { useEditorStore } from '../store/editorStore.js';

/**
 * @param {boolean} dirty
 * @returns {Promise<boolean>} true if the user chose to proceed
 */
export async function confirmDiscardChanges(dirty) {
  if (!dirty) return true;
  return useEditorStore.getState().requestConfirm({
    title: 'Unsaved changes',
    message: 'You have unsaved changes. Discard them and continue?',
    yesLabel: 'Yes',
    noLabel: 'No',
  });
}
