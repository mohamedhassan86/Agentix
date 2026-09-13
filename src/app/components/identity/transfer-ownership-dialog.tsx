"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface TransferTarget {
  id: string;
  displayName: string;
  role: string;
}

export interface TransferOwnershipDialogProps {
  open: boolean;
  targets: TransferTarget[];
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { targetMemberId: string; confirmation: "TRANSFER" }) => Promise<void> | void;
}

export function TransferOwnershipDialog({
  open,
  targets,
  pending = false,
  error = null,
  onClose,
  onSubmit,
}: TransferOwnershipDialogProps) {
  const targetId = useId();
  const confirmId = useId();
  const firstField = useRef<HTMLSelectElement>(null);
  const [targetMemberId, setTargetMemberId] = useState(targets[0]?.id ?? "");
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
    setLocalError(null);
    if (confirmation !== "TRANSFER") {
      setLocalError("Type TRANSFER to confirm");
      return;
    }
    if (!targetMemberId) {
      setLocalError("Select a member");
      return;
    }
    await onSubmit({ targetMemberId, confirmation: "TRANSFER" });
  }

  const shownError = localError ?? error;

  return (
    <div className="dialog-backdrop" onKeyDown={handleKey}>
      <dialog className="card dialog-panel" open aria-labelledby={`${targetId}-title`}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="card-header">
            <h2 id={`${targetId}-title`}>Transfer ownership</h2>
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
            <label htmlFor={targetId}>New owner</label>
            <select id={targetId} ref={firstField} value={targetMemberId} disabled={pending} onChange={(e) => setTargetMemberId(e.target.value)}>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.displayName} ({target.role})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor={confirmId}>Type TRANSFER</label>
            <input id={confirmId} value={confirmation} disabled={pending} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending}>
            Transfer
          </button>
        </form>
      </dialog>
    </div>
  );
}
