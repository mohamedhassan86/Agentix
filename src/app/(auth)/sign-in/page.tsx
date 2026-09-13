"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/app/components/identity/auth-form";

export default function SignInPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionUser, setSessionUser] = useState<string | null>(null);

  return (
    <>
      {sessionUser ? (
        <div className="card">
          <div className="card-header">
            <h1>Signed in</h1>
          </div>
          <p aria-live="polite">Signed in. No organization is active until you create or select one.</p>
        </div>
      ) : (
        <AuthForm
          mode="sign-in"
          pending={pending}
          error={error}
          onSubmit={async ({ email, password }) => {
            setPending(true);
            setError(null);
            try {
              const res = await fetch("/api/v1/auth/sign-in", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              if (!res.ok) {
                const problem = await res.json().catch(() => ({}));
                setError(problem.title ?? "Authentication failed");
                return;
              }
              const body = await res.json();
              setSessionUser(body.userId);
            } finally {
              setPending(false);
            }
          }}
        />
      )}
      <p style={{ marginTop: "16px", color: "var(--muted)" }}>
        Need an account? <Link href="/sign-up">Create account</Link>
      </p>
    </>
  );
}
