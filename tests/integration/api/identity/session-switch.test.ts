import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as session } from "@/app/api/v1/session/route";
import { PUT as switchOrg } from "@/app/api/v1/session/active-organization/route";
import { GET as getActive } from "@/app/api/v1/organization/route";
import { GET as listMembers } from "@/app/api/v1/organization/members/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { createOwnedOrganization, inviteAndAccept } from "../../../helpers/identity-org";
import { registerAndSignIn } from "../../../helpers/identity-http";

describe("session switch", () => {
  let harness: IdentityHarness;
  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("sign-in starts with null active org and switch selects only own memberships", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("owner@example.test", "alpha-org");
    const invitee = await inviteAndAccept({ ownerCookie, store: harness.store, email: "admin@example.test", role: "admin" });
    const ctx = await session(new Request("http://localhost/api/v1/session", { headers: { Cookie: invitee.cookie } }));
    expect((await ctx.json()).activeOrganizationId).toBeNull();

    const orgId = [...harness.store.orgs.values()][0].id;
    const switched = await switchOrg(
      new Request("http://localhost/api/v1/session/active-organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: invitee.cookie },
        body: JSON.stringify({ organizationId: orgId }),
      }),
    );
    expect(switched.status).toBe(200);
    expect((await switched.json()).activeRole).toBe("admin");
    const active = await getActive(new Request("http://localhost/api/v1/organization", { headers: { Cookie: invitee.cookie } }));
    expect(active.status).toBe(200);
    const members = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: invitee.cookie } }));
    expect(members.status).toBe(200);

    const { cookie: stranger } = await registerAndSignIn("stranger@example.test");
    const denied = await switchOrg(
      new Request("http://localhost/api/v1/session/active-organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: stranger },
        body: JSON.stringify({ organizationId: orgId }),
      }),
    );
    expect(denied.status).toBe(404);
    expect((await denied.json()).code).toBe("ORGANIZATION_NOT_FOUND");
  });
});
