"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

export interface CreateOrganizationDialogProps {
  open: boolean;
  pending?: boolean;
  error?: string | null;
  suggestedSlug?: string;
  onClose: () => void;
  onNameChange?: (name: string) => void;
  onSubmit: (input: { name: string; slug?: string }) => Promise<void> | void;
}

export function CreateOrganizationDialog({
  open,
  pending = false,
  error = null,
  suggestedSlug,
  onClose,
  onNameChange,
  onSubmit,
}: CreateOrganizationDialogProps) {
  const nameId = useId();
  const slugId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    firstField.current?.focus();
  }, [open]);

  useEffect(() => {
    if (suggestedSlug && !slug) setSlug(suggestedSlug);
  }, [suggestedSlug, slug]);

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
    if (!name.trim()) {
      setLocalError("Organization name is required");
      return;
    }
    await onSubmit({ name: name.trim(), slug: slug.trim() || undefined });
  }

  const shownError = localError ?? error;

  return (
    <div className="dialog-backdrop" onKeyDown={handleKey}>
      <dialog className="card dialog-panel" open aria-labelledby={`${nameId}-title`} ref={dialogRef}>
        <form onSubmit={handleSubmit} noValidate>
          <div className="card-header">
            <h2 id={`${nameId}-title`}>Create organization</h2>
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
            <label htmlFor={nameId}>Organization name</label>
            <input
              id={nameId}
              ref={firstField}
              name="name"
              value={name}
              disabled={pending}
              onChange={(e) => {
                setName(e.target.value);
                onNameChange?.(e.target.value);
              }}
            />
          </div>
          <div className="field">
            <label htmlFor={slugId}>Slug</label>
            <input
              id={slugId}
              name="slug"
              value={slug}
              disabled={pending}
              onChange={(e) => setSlug(e.target.value)}
              aria-describedby={`${slugId}-hint`}
            />
            <p id={`${slugId}-hint`} style={{ color: "var(--muted)", fontSize: "11px", marginTop: "6px" }}>
              3–48 lowercase letters, digits, and hyphens. Suggestion is not reserved until you create.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
            {pending ? "Creating…" : "Create organization"}
          </button>
        </form>
      </dialog>
    </div>
  );
}
