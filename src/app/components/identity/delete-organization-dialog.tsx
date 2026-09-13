"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface DeleteOrganizationDialogProps {
  open: boolean;
  slug: string;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (confirmationSlug: string) => Promise<void> | void;
}

export function DeleteOrganizationDialog({
  open,
  slug,
  pending = false,
  error = null,
  onClose,
  onSubmit,
}: DeleteOrganizationDialogProps) {
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
    if (confirmation !== slug) {
      setLocalError("Type the current slug to confirm deletion");
      return;
    }
    await onSubmit(confirmation);
  }

  const shownError = localError ?? error;

  return (
    <div className="dialog-backdrop" onKeyDown={handleKey}>
      <dialog className="card dialog-panel" open aria-labelledby={`${confirmId}-title`}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="card-header">
            <h2 id={`${confirmId}-title`}>Delete organization</h2>
            <button className="btn" type="button" onClick={onClose} disabled={pending}>
              Close
            </button>
          </div>
          {shownError ? (
            <div className="banner" role="alert" aria-live="polite">
              {shownError}
            </div>
          ) : null}
          <p style={{ color: "var(--muted)" }}>Type {slug} to confirm. The slug stays reserved.</p>
          <div className="field">
            <label htmlFor={confirmId}>Confirmation slug</label>
            <input id={confirmId} ref={firstField} value={confirmation} disabled={pending} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <button className="btn" type="submit" disabled={pending}>
            Delete organization
          </button>
        </form>
      </dialog>
    </div>
  );
}
