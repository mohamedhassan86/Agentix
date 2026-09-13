"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { handleDialogKeyDown } from "./dialog-chrome";

export interface InviteDialogProps {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (input: { email: string; role: "viewer" | "member" | "admin" }) => Promise<void> | void;
}

export function InviteDialog({ open, pending = false, error = null, onClose, onSubmit }: InviteDialogProps) {
  const emailId = useId();
  const roleId = useId();
  const firstField = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "member" | "admin">("member");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    firstField.current?.focus();
    return () => {
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  function handleKey(event: KeyboardEvent<HTMLElement>) {
    handleDialogKeyDown(event, onClose);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!email.trim()) {
      setLocalError("Email is required");
      return;
    }
    await onSubmit({ email: email.trim(), role });
  }

  const shownError = localError ?? error;

  return (
    <div className="dialog-backdrop" onKeyDown={handleKey}>
      <dialog className="card dialog-panel" open aria-labelledby={`${emailId}-title`}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="card-header">
            <h2 id={`${emailId}-title`}>Invite teammate</h2>
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
            <label htmlFor={emailId}>Email</label>
            <input id={emailId} ref={firstField} type="email" value={email} disabled={pending} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={roleId}>Role</label>
            <select id={roleId} value={role} disabled={pending} onChange={(e) => setRole(e.target.value as "viewer" | "member" | "admin")}>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Inviting…" : "Send invitation"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
