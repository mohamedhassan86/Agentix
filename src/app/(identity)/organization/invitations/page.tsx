"use client";

import { useEffect, useState } from "react";
import { InviteDialog } from "@/app/components/identity/invite-dialog";
import { InvitationList } from "@/app/components/identity/invitation-list";

interface InvitationItem {
  id: string;
  email: string;
  role: string;
  status: string;
  deliveryState: string;
  ageSeconds: number;
}

export default function InvitationsPage() {
  const [items, setItems] = useState<InvitationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  async function refresh() {
    const [list, session] = await Promise.all([
      fetch("/api/v1/organization/invitations"),
      fetch("/api/v1/session"),
    ]);
    if (list.ok) {
      const body = await list.json();
      setItems(body.items ?? []);
    }
    if (session.ok) {
      const ctx = await session.json();
      setCanManage(ctx.activeRole === "owner" || ctx.activeRole === "admin");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <div className="card-header">
        <h1>Invitations</h1>
        {canManage ? (
          <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
            Invite
          </button>
        ) : null}
      </div>
      <InvitationList
        items={items}
        canManage={canManage}
        disabled={pending}
        onResend={async (id) => {
          setPending(true);
          await fetch(`/api/v1/organization/invitations/${id}/resend`, { method: "POST" });
          await refresh();
          setPending(false);
        }}
        onRevoke={async (id) => {
          setPending(true);
          await fetch(`/api/v1/organization/invitations/${id}/revoke`, { method: "POST" });
          await refresh();
          setPending(false);
        }}
      />
      <InviteDialog
        open={open}
        pending={pending}
        error={error}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch("/api/v1/organization/invitations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(input),
            });
            if (!res.ok) {
              const problem = await res.json().catch(() => ({}));
              setError(problem.title ?? "Could not invite");
              return;
            }
            setOpen(false);
            await refresh();
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}
