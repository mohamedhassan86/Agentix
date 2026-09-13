"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthForm } from "@/app/components/identity/auth-form";

export default function SignUpPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <>
      {done ? (
        <div className="card">
          <div className="card-header">
            <h1>Check your messages</h1>
          </div>
          <p aria-live="polite">Account created. Verification is queued. You can sign in without verifying.</p>
        </div>
      ) : (
        <AuthForm
          mode="sign-up"
          pending={pending}
          error={error}
          onSubmit={async ({ email, password, displayName }) => {
            setPending(true);
            setError(null);
            try {
              const res = await fetch("/api/v1/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, displayName }),
              });
              if (!res.ok) {
                const problem = await res.json().catch(() => ({}));
                setError(problem.title ?? "Registration failed");
                return;
              }
              setDone(true);
            } finally {
              setPending(false);
            }
          }}
        />
      )}
      <p style={{ marginTop: "16px", color: "var(--muted)" }}>
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
