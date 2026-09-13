"use client";

import { useEffect, useState } from "react";
import { OrganizationSettings } from "@/app/components/identity/organization-settings";
import { LoadingState } from "@/app/components/identity/loading";
import { ErrorState } from "@/app/components/identity/error";
import { PermissionDenied } from "@/app/components/identity/permission-denied";
import { NoActiveOrg } from "@/app/components/identity/no-active-org";

export default function SettingsPage() {
  const [profile, setProfile] = useState<{ name: string; slug: string; currentRole: string | null } | null>(null);
  const [error, setError] = useState<{ code?: string; title?: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    const res = await fetch("/api/v1/organization");
    if (!res.ok) {
      const problem = await res.json().catch(() => ({}));
      setError({ code: problem.code, title: problem.title });
      return;
    }
    setError(null);
    setProfile(await res.json());
  }

  useEffect(() => {
    void load();
  }, []);

  if (!profile && !error) {
    return <LoadingState label="Loading organization settings…" />;
  }
  if (error?.code === "NO_ACTIVE_ORGANIZATION") {
    return <NoActiveOrg onChoose={() => { window.location.href = "/organizations"; }} />;
  }
  if (error?.code === "PERMISSION_DENIED") {
    return <PermissionDenied detail={error.title} />;
  }
  if (!profile) {
    return <ErrorState title={error?.title ?? "Could not load settings"} onRetry={() => void load()} />;
  }

  return (
    <OrganizationSettings
      name={profile.name}
      slug={profile.slug}
      currentRole={profile.currentRole}
      pending={pending}
      error={error?.title ?? null}
      onSave={async (input) => {
        setPending(true);
        try {
          const res = await fetch("/api/v1/organization", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            setError({ code: problem.code, title: problem.title ?? "Could not update organization" });
            return;
          }
          setError(null);
          setProfile(await res.json());
        } finally {
          setPending(false);
        }
      }}
      onDelete={async (confirmationSlug) => {
        setPending(true);
        try {
          const res = await fetch("/api/v1/organization", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ confirmationSlug }),
          });
          if (!res.ok) {
            const problem = await res.json().catch(() => ({}));
            setError({ code: problem.code, title: problem.title ?? "Could not delete organization" });
          }
        } finally {
          setPending(false);
        }
      }}
    />
  );
}
