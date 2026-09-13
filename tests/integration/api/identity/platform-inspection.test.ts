import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET as inspectOrg } from "@/app/api/v1/platform/organizations/[organizationId]/route";
import { GET as inspectMembers } from "@/app/api/v1/platform/organizations/[organizationId]/members/route";
import { GET as inspectInvites } from "@/app/api/v1/platform/organizations/[organizationId]/invitations/route";
import { POST as createOrg } from "@/app/api/v1/organizations/route";
import { POST as createInvite } from "@/app/api/v1/organization/invitations/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { createOwnedOrganization } from "../../../helpers/identity-org";
import { registerAndSignIn } from "../../../helpers/identity-http";
import { PlatformAdminService } from "@/infrastructure/identity/auth/platform-admin-service";

describe("platform inspection", () => {
  let harness: IdentityHarness;
  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("grants only with zero memberships and allows read-only inspect", async () => {
    const { cookie: ownerCookie } = await createOwnedOrganization("owner@example.test", "alpha-org");
    const orgId = [...harness.store.orgs.values()][0].id;
    const service = new PlatformAdminService(harness.store, harness.clock);
    const ownerUser = [...harness.store.users.values()][0];
    await expect(service.grant(ownerUser.id)).rejects.toMatchObject({ code: "OWNER_INVARIANT" });

    const { cookie: adminCookie, email } = await registerAndSignIn("platform@example.test");
    const adminUser = [...harness.store.users.values()].find((u) => u.emailNormalized === email)!;
    await service.grant(adminUser.id);
    const signed = await (await import("@/app/api/v1/auth/sign-in/route")).POST(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "platform@example.test", password: "password123" }),
      }),
    );
    const { cookieFrom } = await import("../../../helpers/identity-http");
    const grantedCookie = cookieFrom(signed);
    void adminCookie;

    const profile = await inspectOrg(
      new Request(`http://localhost/api/v1/platform/organizations/${orgId}`, { headers: { Cookie: grantedCookie } }),
      { params: { organizationId: orgId } },
    );
    expect(profile.status).toBe(200);
    expect((await profile.json()).currentRole).toBeNull();

    const members = await inspectMembers(
      new Request(`http://localhost/api/v1/platform/organizations/${orgId}/members`, { headers: { Cookie: grantedCookie } }),
      { params: { organizationId: orgId } },
    );
    expect(members.status).toBe(200);

    const invites = await inspectInvites(
      new Request(`http://localhost/api/v1/platform/organizations/${orgId}/invitations`, { headers: { Cookie: grantedCookie } }),
      { params: { organizationId: orgId } },
    );
    expect(invites.status).toBe(200);

    const create = await createOrg(
      new Request("http://localhost/api/v1/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: grantedCookie },
        body: JSON.stringify({ name: "Nope", slug: "nope-org" }),
      }),
    );
    expect(create.status).toBe(403);

    const ownerInspect = await inspectOrg(
      new Request(`http://localhost/api/v1/platform/organizations/${orgId}`, { headers: { Cookie: ownerCookie } }),
      { params: { organizationId: orgId } },
    );
    expect(ownerInspect.status).toBe(403);
    void createInvite;
  });
});
