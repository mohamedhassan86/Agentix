"use client";

import { useEffect, useState } from "react";
import { MembersTable, type MemberRow } from "@/app/components/identity/members-table";
import { LoadingState } from "@/app/components/identity/loading";
import { ErrorState } from "@/app/components/identity/error";
import { PermissionDenied } from "@/app/components/identity/permission-denied";
import { NoActiveOrg } from "@/app/components/identity/no-active-org";
import { Empty } from "@/app/components/identity/empty";

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[] | null>(null);
  const [error, setError] = useState<{ code?: string; title?: string } | null>(null);

  async function load() {
    setError(null);
    const res = await fetch("/api/v1/organization/members");
    if (!res.ok) {
      const problem = await res.json().catch(() => ({}));
      setError({ code: problem.code, title: problem.title });
      setMembers([]);
      return;
    }
    const body = await res.json();
    setMembers(body.items ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  if (members === null && !error) {
    return <LoadingState label="Loading members…" />;
  }
  if (error?.code === "NO_ACTIVE_ORGANIZATION") {
    return <NoActiveOrg onChoose={() => { window.location.href = "/organizations"; }} />;
  }
  if (error?.code === "PERMISSION_DENIED") {
    return <PermissionDenied detail={error.title} />;
  }
  if (error) {
    return <ErrorState title={error.title ?? "Could not load members"} onRetry={() => void load()} />;
  }
  if (!members || members.length === 0) {
    return <Empty title="No members" description="Invite teammates from the invitations page." />;
  }

  return (
    <>
      <div className="card-header">
        <h1>Members</h1>
      </div>
      <MembersTable members={members} />
    </>
  );
}
