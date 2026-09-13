"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ActiveOrganizationPage() {
  const [profile, setProfile] = useState<{ name: string; slug: string; currentRole: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/organization");
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        setError(problem.title ?? "No active organization");
        return;
      }
      setProfile(await res.json());
    })();
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h1>Active organization</h1>
        <Link className="btn" href="/organization/settings">
          Settings
        </Link>
      </div>
      {error ? (
        <p className="banner" role="alert">
          {error}
        </p>
      ) : profile ? (
        <p>
          {profile.name} ({profile.slug}) · {profile.currentRole}
        </p>
      ) : (
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      )}
    </div>
  );
}
