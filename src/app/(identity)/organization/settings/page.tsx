"use client";

import { useEffect, useState } from "react";
import { OrganizationSettings } from "@/app/components/identity/organization-settings";

export default function OrganizationSettingsPage() {
  const [profile, setProfile] = useState<{ name: string; slug: string; currentRole: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

  if (!profile) {
    return (
      <div className="card">
        <h1>Organization settings</h1>
        <p style={{ color: "var(--muted)" }}>{error ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <OrganizationSettings
      name={profile.name}
      slug={profile.slug}
      currentRole={profile.currentRole}
      pending={pending}
      error={error}
      onSave={async (input) => {
        setPending(true);
        setError(null);
        try {
          const res = await fetch("/api/v1/organization", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            setError(problem.title ?? "Could not update organization");
            return;
          }
          setProfile(await res.json());
        } finally {
          setPending(false);
        }
      }}
      onDelete={async (confirmationSlug) => {
        setPending(true);
        setError(null);
        try {
          const res = await fetch("/api/v1/organization", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmationSlug }),
          });
          if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            setError(problem.title ?? "Could not delete organization");
          }
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
