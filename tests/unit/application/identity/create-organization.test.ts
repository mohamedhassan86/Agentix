import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext, type IdentityActor } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { createSignInHandler } from "@/application/identity/handlers/sign-in-handler";
import { createCreateOrganizationHandler } from "@/application/identity/handlers/create-organization-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";
import { CREATE_ORGANIZATION_TYPE } from "@/application/identity/commands/create-organization";
import { createIdentityHarness } from "../../../helpers/identity-harness";

describe("create-organization-handler", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  async function actor(email = "owner@example.test"): Promise<IdentityActor> {
    await createRegisterAccountHandler(harness.deps)(
      { type: REGISTER_ACCOUNT_TYPE, email, displayName: "Owner", password: "password123" },
      createRequestContext(),
    );
    const signed = await createSignInHandler(harness.deps)(
      { type: SIGN_IN_TYPE, email, password: "password123" },
      createRequestContext(),
    );
    const resolved = await harness.composition.sessionService.resolveActor(signed.rawSessionToken);
    if (!resolved) throw new Error("missing actor");
    return resolved;
  }

  it("creates org with one Owner, makes it active, and records events", async () => {
    const current = await actor();
    const result = await createCreateOrganizationHandler(harness.deps)(
      { type: CREATE_ORGANIZATION_TYPE, name: "Alpha Org", slug: "alpha-org" },
      createRequestContext({ actor: current }),
    );
    expect(result.slug).toBe("alpha-org");
    expect(result.currentRole).toBe("owner");
    const counts = await harness.store.countRolesByOrg(result.id);
    expect(counts.owner).toBe(1);
    const session = await harness.store.findSessionById(current.sessionId);
    expect(session?.activeOrgId).toBe(result.id);
    expect(harness.store.events.map((e) => e.eventType)).toEqual(
      expect.arrayContaining(["organization.created", "membership.joined"]),
    );
  });

  it("rejects duplicate slug including deleted and platform admin", async () => {
    const current = await actor();
    const handle = createCreateOrganizationHandler(harness.deps);
    await handle(
      { type: CREATE_ORGANIZATION_TYPE, name: "Alpha Org", slug: "alpha-org" },
      createRequestContext({ actor: current }),
    );
    await expect(
      handle(
        { type: CREATE_ORGANIZATION_TYPE, name: "Other", slug: "alpha-org" },
        createRequestContext({ actor: current }),
      ),
    ).rejects.toMatchObject({ code: "SLUG_CONFLICT", status: 409 });

    const admin = await actor("admin@example.test");
    const user = await harness.store.findUserById(admin.userId);
    user!.grantPlatformAdmin(0);
    await harness.store.updateUser(user!);
    admin.isPlatformAdmin = true;
    await expect(
      handle(
        { type: CREATE_ORGANIZATION_TYPE, name: "Beta", slug: "beta-org" },
        createRequestContext({ actor: admin }),
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED", status: 403 });
  });
});
