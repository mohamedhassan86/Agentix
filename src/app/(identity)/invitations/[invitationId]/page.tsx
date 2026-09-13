"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { InvitationPreview } from "@/app/components/identity/invitation-preview";

export default function InvitationPreviewPage() {
  const params = useParams<{ invitationId: string }>();
  const search = useSearchParams();
  const [preview, setPreview] = useState<{
    organizationName: string;
    invitedEmail: string;
    role: string;
    status: string;
    expiresAt: string;
    accountRequired: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = search.get("token") ?? "";
    void (async () => {
      const res = await fetch(`/api/v1/invitations/${params.invitationId}?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const problem = await res.json().catch(() => ({}));
        setError(problem.title ?? "Invalid invitation");
        return;
      }
      setPreview(await res.json());
    })();
  }, [params.invitationId, search]);

  if (!preview) {
    return (
      <div className="card">
        <h1>Invitation</h1>
        <p style={{ color: "var(--muted)" }}>{error ?? "Loading…"}</p>
      </div>
    );
  }

  return <InvitationPreview {...preview} error={error} />;
}
