"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface DeleteAccountDialogProps {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  blockedReason?: string | null;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
}

export function DeleteAccountDialog({
  open,
  pending = false,
  error = null,
  blockedReason = null,
  onClose,
  onSubmit,
}: DeleteAccountDialogProps) {
  const confirmId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) firstField.current?.focus();
  }, [open]);

  if (!open) return null;

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (blockedReason) return;
    if (confirmation !== "DELETE") {
      setLocalError("Type DELETE to confirm");
      return;
    }
    await onSubmit();
  }

  const shownError = localError ?? error ?? blockedReason;

  return (
    <div className="dialog-backdrop" onKeyDown={handleKey}>
      <dialog className="card dialog-panel" open aria-labelledby={`${confirmId}-title`}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="card-header">
            <h2 id={`${confirmId}-title`}>Delete account</h2>
            <button className="btn" type="button" onClick={onClose} disabled={pending}>
              Close
            </button>
          </div>
          {shownError ? (
            <div className="banner" role="alert" aria-live="polite">
              {shownError}
            </div>
          ) : null}
          <div className="field">
            <label htmlFor={confirmId}>Type DELETE</label>
            <input id={confirmId} ref={firstField} value={confirmation} disabled={pending || Boolean(blockedReason)} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={pending || Boolean(blockedReason)} title={blockedReason ?? undefined}>
            Delete account
          </button>
        </form>
      </dialog>
    </div>
  );
}
