import { useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore.js';

export function ConfirmDialog() {
  const confirmDialog = useEditorStore((s) => s.confirmDialog);
  const answerConfirm = useEditorStore((s) => s.answerConfirm);
  const yesRef = useRef(null);

  useEffect(() => {
    if (!confirmDialog) return;
    yesRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        answerConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDialog, answerConfirm]);

  if (!confirmDialog) return null;

  const { title, message, yesLabel, noLabel } = confirmDialog;

  return (
    <div
      className="khedConfirmBackdrop"
      role="presentation"
      onClick={() => answerConfirm(false)}
    >
      <div
        className="khedConfirmDialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="khedConfirmTitle"
        aria-describedby="khedConfirmMessage"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="khedConfirmTitle">{title}</h2>
        <p id="khedConfirmMessage">{message}</p>
        <div className="khedConfirmActions">
          <button type="button" className="khedConfirmNo" onClick={() => answerConfirm(false)}>
            {noLabel}
          </button>
          <button
            ref={yesRef}
            type="button"
            className="khedConfirmYes"
            onClick={() => answerConfirm(true)}
          >
            {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
