import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext, type IdentityActor } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { createSignInHandler } from "@/application/identity/handlers/sign-in-handler";
import { createCreateOrganizationHandler } from "@/application/identity/handlers/create-organization-handler";
import { createSwitchActiveOrganizationHandler } from "@/application/identity/handlers/switch-active-organization-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";
import { CREATE_ORGANIZATION_TYPE } from "@/application/identity/commands/create-organization";
import { SWITCH_ACTIVE_ORGANIZATION_TYPE } from "@/application/identity/commands/switch-active-organization";
import { createIdentityHarness } from "../../../helpers/identity-harness";

describe("switch-organization-handler", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  async function actor(email: string): Promise<IdentityActor> {
    await createRegisterAccountHandler(harness.deps)(
      { type: REGISTER_ACCOUNT_TYPE, email, displayName: email.split("@")[0], password: "password123" },
      createRequestContext(),
    );
    const signed = await createSignInHandler(harness.deps)(
      { type: SIGN_IN_TYPE, email, password: "password123" },
      createRequestContext(),
    );
    const resolved = await harness.composition.sessionService.resolveActor(signed.rawSessionToken);
    if (!resolved) throw new Error("missing");
    return resolved;
  }

  it("switches only to own memberships and 404s foreign ids", async () => {
    const owner = await actor("owner@example.test");
    const org = await createCreateOrganizationHandler(harness.deps)(
      { type: CREATE_ORGANIZATION_TYPE, name: "Alpha", slug: "alpha-org" },
      createRequestContext({ actor: owner }),
    );
    const switched = await createSwitchActiveOrganizationHandler(harness.deps)(
      { type: SWITCH_ACTIVE_ORGANIZATION_TYPE, organizationId: org.id },
      createRequestContext({ actor: owner }),
    );
    expect(switched.activeOrganizationId).toBe(org.id);
    expect(switched.activeRole).toBe("owner");

    const stranger = await actor("stranger@example.test");
    await expect(
      createSwitchActiveOrganizationHandler(harness.deps)(
        { type: SWITCH_ACTIVE_ORGANIZATION_TYPE, organizationId: org.id },
        createRequestContext({ actor: stranger }),
      ),
    ).rejects.toMatchObject({ code: "ORGANIZATION_NOT_FOUND", status: 404 });
  });
});
