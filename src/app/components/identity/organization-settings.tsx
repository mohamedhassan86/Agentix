"use client";

import { useId, useState, type FormEvent } from "react";

export interface OrganizationSettingsProps {
  name: string;
  slug: string;
  currentRole: string | null;
  pending?: boolean;
  error?: string | null;
  onSave: (input: { name?: string; slug?: string }) => Promise<void> | void;
  onDelete: (confirmationSlug: string) => Promise<void> | void;
}

export function OrganizationSettings({
  name,
  slug,
  currentRole,
  pending = false,
  error = null,
  onSave,
  onDelete,
}: OrganizationSettingsProps) {
  const nameId = useId();
  const slugId = useId();
  const confirmId = useId();
  const owner = currentRole === "owner";
  const [nextName, setNextName] = useState(name);
  const [nextSlug, setNextSlug] = useState(slug);
  const [confirmation, setConfirmation] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!owner) {
      setLocalError("Only the Owner can rename or change the slug");
      return;
    }
    await onSave({
      name: nextName.trim() !== name ? nextName.trim() : undefined,
      slug: nextSlug.trim() !== slug ? nextSlug.trim() : undefined,
    });
  }

  async function handleDelete(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!owner) {
      setLocalError("Only the Owner can delete this organization");
      return;
    }
    if (confirmation.trim() !== slug) {
      setLocalError("Type the current slug to confirm deletion");
      return;
    }
    await onDelete(confirmation.trim());
  }

  const shownError = localError ?? error;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Organization settings</h2>
        <span className="status-chip">
          <span className="dot" />
          {currentRole ?? "none"}
        </span>
      </div>
      {shownError ? (
        <div className="banner" role="alert" aria-live="polite">
          {shownError}
        </div>
      ) : null}
      <form onSubmit={handleSave} noValidate>
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input id={nameId} value={nextName} disabled={pending || !owner} onChange={(e) => setNextName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={slugId}>Slug</label>
          <input id={slugId} value={nextSlug} disabled={pending || !owner} onChange={(e) => setNextSlug(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending || !owner} title={!owner ? "Owner only" : undefined}>
          Save
        </button>
      </form>
      <form onSubmit={handleDelete} noValidate style={{ marginTop: "24px" }}>
        <div className="card-header">
          <h3>Danger zone</h3>
        </div>
        <p style={{ color: "var(--muted)", marginBottom: "12px" }}>
          Deleting keeps the slug reserved. Type <strong>{slug}</strong> to confirm.
        </p>
        <div className="field">
          <label htmlFor={confirmId}>Confirmation slug</label>
          <input
            id={confirmId}
            value={confirmation}
            disabled={pending || !owner}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={pending || !owner} title={!owner ? "Owner only" : undefined}>
          Delete organization
        </button>
      </form>
    </div>
  );
}
