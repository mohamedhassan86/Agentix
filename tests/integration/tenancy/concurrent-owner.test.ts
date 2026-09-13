import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PUT as transfer } from "@/app/api/v1/organization/ownership/route";
import { GET as listMembers } from "@/app/api/v1/organization/members/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../helpers/identity-harness";
import { createOwnedOrganization, inviteAndAccept } from "../../helpers/identity-org";

describe("concurrent owner invariant", () => {
  let harness: IdentityHarness;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("serializes two transfers so exactly one Owner remains", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("owner@example.test", "alpha-org");
    const admin = await inviteAndAccept({ ownerCookie, store: harness.store, email: "admin@example.test", role: "admin" });
    const member = await inviteAndAccept({ ownerCookie, store: harness.store, email: "member@example.test", role: "member" });
    for (const session of harness.store.sessions.values()) {
      const org = [...harness.store.orgs.values()][0];
      session.activeOrgId = org.id;
      await harness.store.updateSession(session);
    }
    const listed = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: ownerCookie } }));
    const items = (await listed.json()).items as Array<{ id: string; email: string }>;
    const adminId = items.find((m) => m.email === "admin@example.test")!.id;
    const memberId = items.find((m) => m.email === "member@example.test")!.id;

    const results = await Promise.all([
      transfer(
        new Request("http://localhost/api/v1/organization/ownership", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: JSON.stringify({ targetMemberId: adminId, confirmation: "TRANSFER" }),
        }),
      ),
      transfer(
        new Request("http://localhost/api/v1/organization/ownership", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Cookie: ownerCookie },
          body: JSON.stringify({ targetMemberId: memberId, confirmation: "TRANSFER" }),
        }),
      ),
    ]);
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 200).length).toBeGreaterThanOrEqual(1);
    const after = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: admin.cookie } }));
    expect((await after.json()).roleCounts.owner).toBe(1);
    void member;
  });
});
