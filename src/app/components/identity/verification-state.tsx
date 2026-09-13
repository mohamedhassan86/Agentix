"use client";

export type VerificationUiStatus = "loading" | "ready" | "error" | "unverified" | "verified" | "already_verified";

export function VerificationState({ status, detail }: { status: VerificationUiStatus; detail?: string }) {
  const labels: Record<VerificationUiStatus, string> = {
    loading: "Checking verification…",
    ready: "Enter the verification token from your message.",
    error: detail ?? "Verification failed",
    unverified: "Your email is not verified yet.",
    verified: "Email verified",
    already_verified: "Email already verified",
  };
  return (
    <div className="card">
      <div className="card-header">
        <h1>Email verification</h1>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          {status.replaceAll("_", " ")}
        </span>
      </div>
      <p aria-live="polite">{labels[status]}</p>
    </div>
  );
}
