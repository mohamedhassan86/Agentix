"use client";

export function AccountStatus({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Account</h2>
        <span className="status-chip">
          <span className="dot" aria-hidden="true" />
          {verified ? "verified" : "unverified"}
        </span>
      </div>
      <p aria-live="polite">{verified ? `${email} is verified.` : `${email} is not verified yet.`}</p>
    </div>
  );
}
