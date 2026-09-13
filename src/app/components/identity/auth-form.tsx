"use client";

import { useId, useState, type FormEvent } from "react";

export type AuthFormMode = "sign-in" | "sign-up";

export interface AuthFormProps {
  mode: AuthFormMode;
  onSubmit: (input: { email: string; password: string; displayName?: string }) => Promise<void>;
  pending?: boolean;
  error?: string | null;
}

export function AuthForm({ mode, onSubmit, pending = false, error = null }: AuthFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const nameId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    if (!email.trim()) {
      setLocalError("Email is required");
      return;
    }
    if (mode === "sign-up" && !displayName.trim()) {
      setLocalError("Display name is required");
      return;
    }
    if (password.length < (mode === "sign-up" ? 8 : 1)) {
      setLocalError(mode === "sign-up" ? "Password must be at least 8 characters" : "Password is required");
      return;
    }
    await onSubmit({ email, password, displayName: displayName.trim() || undefined });
  }

  const shownError = localError ?? error;

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <div className="card-header">
        <h1>{mode === "sign-up" ? "Create account" : "Sign in"}</h1>
      </div>
      {shownError ? (
        <div className="banner" role="alert" aria-live="polite">
          {shownError}
        </div>
      ) : null}
      {mode === "sign-up" ? (
        <div className="field">
          <label htmlFor={nameId}>Display name</label>
          <input
            id={nameId}
            name="displayName"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={pending}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={emailId}>Email</label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="field">
        <label htmlFor={passwordId}>Password</label>
        <input
          id={passwordId}
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </div>
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Working…" : mode === "sign-up" ? "Register" : "Sign in"}
      </button>
    </form>
  );
}
