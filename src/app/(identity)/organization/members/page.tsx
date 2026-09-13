"use client";

import { useEffect, useState } from "react";
import { MembersTable } from "@/app/components/identity/members-table";
import { MemberActions } from "@/app/components/identity/member-actions";
import { TransferOwnershipDialog } from "@/app/components/identity/transfer-ownership-dialog";
import { RoleMatrix } from "@/app/components/identity/role-matrix";

interface MemberRow {
  id: string;
  displayName: string;
  email: string;
  role: string;
}

export default function MembersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [actorRole, setActorRole] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function refresh() {
    const [list, session] = await Promise.all([fetch("/api/v1/organization/members"), fetch("/api/v1/session")]);
    if (list.ok) setMembers((await list.json()).items ?? []);
    if (session.ok) setActorRole((await session.json()).activeRole ?? null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <>
      <div className="card-header">
        <h1>Members</h1>
        {actorRole === "owner" ? (
          <button className="btn" type="button" onClick={() => setOpen(true)}>
            Transfer ownership
          </button>
        ) : null}
      </div>
      <MembersTable members={members} />
      {members.map((member) => (
        <MemberActions
          key={member.id}
          memberId={member.id}
          role={member.role}
          actorRole={actorRole}
          onChangeRole={async (id, role) => {
            await fetch(`/api/v1/organization/members/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role }),
            });
            await refresh();
          }}
          onRemove={async (id) => {
            await fetch(`/api/v1/organization/members/${id}`, { method: "DELETE" });
            await refresh();
          }}
        />
      ))}
      <RoleMatrix />
      <TransferOwnershipDialog
        open={open}
        targets={members.filter((m) => m.role !== "owner")}
        onClose={() => setOpen(false)}
        onSubmit={async (input) => {
          await fetch("/api/v1/organization/ownership", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
          setOpen(false);
          await refresh();
        }}
      />
    </>
  );
}
