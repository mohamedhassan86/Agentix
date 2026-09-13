import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as listMembers } from "@/app/api/v1/organization/members/route";
import { PATCH as changeRole, DELETE as removeMember } from "@/app/api/v1/organization/members/[memberId]/route";
import { DELETE as leave } from "@/app/api/v1/organization/membership/route";
import { PUT as transfer } from "@/app/api/v1/organization/ownership/route";
import { POST as createInvite } from "@/app/api/v1/organization/invitations/route";
import { DELETE as deleteAccount } from "@/app/api/v1/account/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { createOwnedOrganization, inviteAndAccept } from "../../../helpers/identity-org";

async function activateOrg(harness: IdentityHarness, cookie: string): Promise<void> {
  const org = [...harness.store.orgs.values()][0];
  for (const session of harness.store.sessions.values()) {
    if (!session.revokedAt) {
      session.activeOrgId = org.id;
      await harness.store.updateSession(session);
    }
  }
  void cookie;
}

describe("permission matrix", () => {
  let harness: IdentityHarness;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("enumerates Y/N cells for invite, role, remove, leave, transfer, delete account", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("owner@example.test", "alpha-org");
    const admin = await inviteAndAccept({ ownerCookie, store: harness.store, email: "admin@example.test", role: "admin" });
    const member = await inviteAndAccept({ ownerCookie, store: harness.store, email: "member@example.test", role: "member" });
    const viewer = await inviteAndAccept({ ownerCookie, store: harness.store, email: "viewer@example.test", role: "viewer" });
    await activateOrg(harness, ownerCookie);

    const listed = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: ownerCookie } }));
    expect(listed.status).toBe(200);
    const page = await listed.json();
    expect(page.roleCounts.owner).toBe(1);
    const ownerRow = page.items.find((m: { role: string }) => m.role === "owner");
    const memberRow = page.items.find((m: { email: string }) => m.email === "member@example.test");
    const adminRow = page.items.find((m: { email: string }) => m.email === "admin@example.test");

    const memberInvite = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: member.cookie },
        body: JSON.stringify({ email: "x@example.test", role: "viewer" }),
      }),
    );
    expect(memberInvite.status).toBe(403);

    const viewerInvite = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: viewer.cookie },
        body: JSON.stringify({ email: "y@example.test", role: "viewer" }),
      }),
    );
    expect(viewerInvite.status).toBe(403);

    const adminRemovesOwner = await removeMember(
      new Request(`http://localhost/api/v1/organization/members/${ownerRow.id}`, { method: "DELETE", headers: { Cookie: admin.cookie } }),
      { params: { memberId: ownerRow.id } },
    );
    expect(adminRemovesOwner.status).toBe(409);
    expect((await adminRemovesOwner.json()).code).toBe("OWNER_INVARIANT");

    const assignOwner = await changeRole(
      new Request(`http://localhost/api/v1/organization/members/${memberRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ role: "owner" }),
      }),
      { params: { memberId: memberRow.id } },
    );
    expect(assignOwner.status).toBe(400);

    const ownerLeave = await leave(new Request("http://localhost/api/v1/organization/membership", { method: "DELETE", headers: { Cookie: ownerCookie } }));
    expect(ownerLeave.status).toBe(409);

    const blockedDelete = await deleteAccount(
      new Request("http://localhost/api/v1/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ confirmation: "DELETE" }),
      }),
    );
    expect(blockedDelete.status).toBe(409);

    const transferred = await transfer(
      new Request("http://localhost/api/v1/organization/ownership", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ targetMemberId: adminRow.id, confirmation: "TRANSFER" }),
      }),
    );
    expect(transferred.status).toBe(200);
    const result = await transferred.json();
    expect(result.owner.role).toBe("owner");
    expect(result.formerOwner.role).toBe("admin");
    const after = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: admin.cookie } }));
    expect((await after.json()).roleCounts.owner).toBe(1);
  });
});
