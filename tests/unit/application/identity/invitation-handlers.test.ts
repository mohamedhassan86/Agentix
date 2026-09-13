import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext, type IdentityActor } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { createSignInHandler } from "@/application/identity/handlers/sign-in-handler";
import { createCreateOrganizationHandler } from "@/application/identity/handlers/create-organization-handler";
import { createCreateInvitationHandler } from "@/application/identity/handlers/create-invitation-handler";
import { createResendInvitationHandler } from "@/application/identity/handlers/resend-invitation-handler";
import { createRevokeInvitationHandler } from "@/application/identity/handlers/revoke-invitation-handler";
import { createAcceptInvitationHandler } from "@/application/identity/handlers/accept-invitation-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";
import { CREATE_ORGANIZATION_TYPE } from "@/application/identity/commands/create-organization";
import { CREATE_INVITATION_TYPE } from "@/application/identity/commands/create-invitation";
import { RESEND_INVITATION_TYPE } from "@/application/identity/commands/resend-invitation";
import { REVOKE_INVITATION_TYPE } from "@/application/identity/commands/revoke-invitation";
import { ACCEPT_INVITATION_TYPE } from "@/application/identity/commands/accept-invitation";
import { createIdentityHarness } from "../../../helpers/identity-harness";

describe("invitation handlers", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  async function signedIn(email: string): Promise<IdentityActor> {
    await createRegisterAccountHandler(harness.deps)(
      { type: REGISTER_ACCOUNT_TYPE, email, displayName: email.split("@")[0], password: "password123" },
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

  async function ownerWithOrg(): Promise<IdentityActor> {
    const actor = await signedIn("owner@example.test");
    await createCreateOrganizationHandler(harness.deps)(
      { type: CREATE_ORGANIZATION_TYPE, name: "Alpha Org", slug: "alpha-org" },
      createRequestContext({ actor }),
    );
    const session = await harness.store.findSessionById(actor.sessionId);
    actor.activeOrgId = session?.activeOrgId ?? null;
    actor.activeRole = "owner";
    return actor;
  }

  it("issues pending invitation with token digest and encrypted outbox", async () => {
    const actor = await ownerWithOrg();
    const invitation = await createCreateInvitationHandler(harness.deps)(
      { type: CREATE_INVITATION_TYPE, email: "admin@example.test", role: "admin" },
      createRequestContext({ actor }),
    );
    expect(invitation.status).toBe("pending");
    expect(invitation.deliveryState).toBe("queued");
    expect(harness.store.lastCapturedToken()).toBeTruthy();
    expect(harness.store.events.map((e) => e.eventType)).toContain("invitation.created");
  });

  it("resend invalidates prior token; revoked cannot accept; wrong email mismatches", async () => {
    const actor = await ownerWithOrg();
    const created = await createCreateInvitationHandler(harness.deps)(
      { type: CREATE_INVITATION_TYPE, email: "admin@example.test", role: "admin" },
      createRequestContext({ actor }),
    );
    const oldToken = harness.store.lastCapturedToken()!;
    await createResendInvitationHandler(harness.deps)(
      { type: RESEND_INVITATION_TYPE, invitationId: created.id },
      createRequestContext({ actor }),
    );
    const newToken = harness.store.lastCapturedToken()!;
    expect(newToken).not.toBe(oldToken);

    const invitee = await signedIn("admin@example.test");
    await expect(
      createAcceptInvitationHandler(harness.deps)(
        { type: ACCEPT_INVITATION_TYPE, invitationId: created.id, token: oldToken },
        createRequestContext({ actor: invitee }),
      ),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    const accepted = await createAcceptInvitationHandler(harness.deps)(
      { type: ACCEPT_INVITATION_TYPE, invitationId: created.id, token: newToken },
      createRequestContext({ actor: invitee }),
    );
    expect(accepted.activeOrganizationChanged).toBe(false);
    expect(accepted.membership.role).toBe("admin");

    await expect(
      createResendInvitationHandler(harness.deps)(
        { type: RESEND_INVITATION_TYPE, invitationId: created.id },
        createRequestContext({ actor }),
      ),
    ).rejects.toMatchObject({ code: "INVITATION_STATE" });
  });

  it("revoke and email mismatch fail closed", async () => {
    const actor = await ownerWithOrg();
    const created = await createCreateInvitationHandler(harness.deps)(
      { type: CREATE_INVITATION_TYPE, email: "viewer@example.test", role: "viewer" },
      createRequestContext({ actor }),
    );
    const token = harness.store.lastCapturedToken()!;
    await createRevokeInvitationHandler(harness.deps)(
      { type: REVOKE_INVITATION_TYPE, invitationId: created.id },
      createRequestContext({ actor }),
    );
    const stranger = await signedIn("stranger@example.test");
    await expect(
      createAcceptInvitationHandler(harness.deps)(
        { type: ACCEPT_INVITATION_TYPE, invitationId: created.id, token },
        createRequestContext({ actor: stranger }),
      ),
    ).rejects.toMatchObject({ code: "TOKEN_INVALID" });

    const second = await createCreateInvitationHandler(harness.deps)(
      { type: CREATE_INVITATION_TYPE, email: "other@example.test", role: "member" },
      createRequestContext({ actor }),
    );
    const otherToken = harness.store.lastCapturedToken()!;
    await expect(
      createAcceptInvitationHandler(harness.deps)(
        { type: ACCEPT_INVITATION_TYPE, invitationId: second.id, token: otherToken },
        createRequestContext({ actor: stranger }),
      ),
    ).rejects.toMatchObject({ code: "INVITATION_EMAIL_MISMATCH" });
  });
});
