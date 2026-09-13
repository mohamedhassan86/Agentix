"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/app/components/identity/empty-state";
import { OrganizationSwitcher } from "@/app/components/identity/organization-switcher";
import { CreateOrganizationDialog } from "@/app/components/identity/create-organization-dialog";
import { LoadingState } from "@/app/components/identity/loading";
import { ErrorState } from "@/app/components/identity/error";
import { ChooseOrganization } from "@/app/components/identity/choose-organization";

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  currentRole: string | null;
}

export default function OrganizationsPage() {
  const [items, setItems] = useState<OrgItem[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [orgsRes, sessionRes] = await Promise.all([fetch("/api/v1/organizations"), fetch("/api/v1/session")]);
        const orgs = orgsRes.ok ? await orgsRes.json() : { items: [] };
        const session = sessionRes.ok ? await sessionRes.json() : { activeOrganizationId: null };
        setItems(orgs.items ?? []);
        setActiveId(session.activeOrganizationId ?? null);
      } catch {
        setLoadError("Could not load organizations");
        setItems([]);
      }
    })();
  }, []);

  return (
    <>
      {items === null ? (
        <LoadingState label="Loading organizations…" />
      ) : loadError ? (
        <ErrorState title={loadError} />
      ) : items.length === 0 ? (
        <EmptyState
          title="No organizations"
          description="Create your first organization to become Owner, or accept an invitation."
          actionLabel="Create organization"
          onAction={() => setOpen(true)}
        />
      ) : !activeId ? (
        <ChooseOrganization
          organizations={items}
          onSelect={(id) => setActiveId(id)}
          onCreate={() => setOpen(true)}
        />
      ) : (
        <OrganizationSwitcher
          organizations={items}
          activeOrganizationId={activeId}
          onSelect={(id) => setActiveId(id)}
          onCreate={() => setOpen(true)}
        />
      )}
      <CreateOrganizationDialog
        open={open}
        pending={pending}
        error={error}
        suggestedSlug={suggested}
        onClose={() => setOpen(false)}
        onNameChange={async (name) => {
          if (!name.trim()) return;
          const res = await fetch(`/api/v1/organizations/slug-suggestion?name=${encodeURIComponent(name)}`);
          if (res.ok) {
            const body = await res.json();
            setSuggested(body.slug);
          }
        }}
        onSubmit={async ({ name, slug }) => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/v1/organizations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, slug }),
            });
            if (!res.ok) {
              const problem = await res.json().catch(() => ({}));
              setError(problem.title ?? "Could not create organization");
              return;
            }
            const created = await res.json();
            setItems((prev) => [...(prev ?? []), created]);
            setActiveId(created.id);
            setOpen(false);
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}
