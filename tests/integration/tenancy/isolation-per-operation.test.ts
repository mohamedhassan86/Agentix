import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PUT as switchOrg } from "@/app/api/v1/session/active-organization/route";
import { GET as getActive, PATCH as updateOrg } from "@/app/api/v1/organization/route";
import { GET as listMembers } from "@/app/api/v1/organization/members/route";
import { GET as listInvites } from "@/app/api/v1/organization/invitations/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../helpers/identity-harness";
import { createOwnedOrganization } from "../../helpers/identity-org";
import { registerAndSignIn } from "../../helpers/identity-http";

describe("tenant isolation per operation", () => {
  let harness: IdentityHarness;
  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("never-member 404 matches nonexistent; no active org leaks zero tenant fields", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("a@example.test", "org-one");
    const orgId = [...harness.store.orgs.values()][0].id;
    const { cookie: other } = await registerAndSignIn("b@example.test");

    const missing = crypto.randomUUID();
    const neverMember = await switchOrg(
      new Request("http://localhost/api/v1/session/active-organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: other },
        body: JSON.stringify({ organizationId: orgId }),
      }),
    );
    const nonexistent = await switchOrg(
      new Request("http://localhost/api/v1/session/active-organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Cookie: other },
        body: JSON.stringify({ organizationId: missing }),
      }),
    );
    const neverBody = await neverMember.json();
    const missingBody = await nonexistent.json();
    expect(neverMember.status).toBe(404);
    expect(nonexistent.status).toBe(404);
    expect(neverBody.code).toBe(missingBody.code);
    expect(neverBody.title).toBe(missingBody.title);
    expect(JSON.stringify(neverBody)).not.toMatch(/org-one|a@example.test/);

    const noActive = await getActive(new Request("http://localhost/api/v1/organization", { headers: { Cookie: other } }));
    expect(noActive.status).toBe(403);
    expect((await noActive.json()).code).toBe("NO_ACTIVE_ORGANIZATION");

    const members = await listMembers(new Request("http://localhost/api/v1/organization/members", { headers: { Cookie: other } }));
    expect(members.status).toBe(403);
    const invites = await listInvites(new Request("http://localhost/api/v1/organization/invitations", { headers: { Cookie: other } }));
    expect(invites.status).toBe(403);
    const mutate = await updateOrg(
      new Request("http://localhost/api/v1/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: other },
        body: JSON.stringify({ name: "Hack" }),
      }),
    );
    expect(mutate.status).toBe(403);
    void ownerCookie;
  });
});
