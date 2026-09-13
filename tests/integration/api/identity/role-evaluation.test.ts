import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PATCH as changeRole, DELETE as removeMember } from "@/app/api/v1/organization/members/[memberId]/route";
import { POST as createInvite } from "@/app/api/v1/organization/invitations/route";
import { GET as listMembers } from "@/app/api/v1/organization/members/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { createOwnedOrganization, inviteAndAccept } from "../../../helpers/identity-org";

describe("role evaluation", () => {
  let harness: IdentityHarness;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("downgrade and removal take effect on the next request", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("owner@example.test", "alpha-org");
    const admin = await inviteAndAccept({ ownerCookie, store: harness.store, email: "admin@example.test", role: "admin" });
    for (const session of harness.store.sessions.values()) {
      session.activeOrgId = [...harness.store.orgs.values()][0].id;
      await harness.store.updateSession(session);
    }
    const listed = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: ownerCookie } }));
    const adminRow = (await listed.json()).items.find((m: { email: string }) => m.email === "admin@example.test");
    const downgraded = await changeRole(
      new Request(`http://localhost/api/v1/organization/members/${adminRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: ownerCookie },
        body: JSON.stringify({ role: "member" }),
      }),
      { params: { memberId: adminRow.id } },
    );
    expect(downgraded.status).toBe(200);
    const invite = await createInvite(
      new Request("http://localhost/api/v1/organization/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: admin.cookie },
        body: JSON.stringify({ email: "z@example.test", role: "viewer" }),
      }),
    );
    expect(invite.status).toBe(403);

    const removed = await removeMember(
      new Request(`http://localhost/api/v1/organization/members/${adminRow.id}`, { method: "DELETE", headers: { Cookie: ownerCookie } }),
      { params: { memberId: adminRow.id } },
    );
    expect(removed.status).toBe(204);
    const afterRemove = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: admin.cookie } }));
    expect(afterRemove.status).toBeGreaterThanOrEqual(400);
  });
});
