import type { RequestContext } from "@/application/shared/context/request-context";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import {
  InvitationStateError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from "@/domain/identity/errors/identity-errors";
import { InvitationPolicy } from "@/domain/identity/policies/invitation-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { ResendInvitationCommand } from "../commands/resend-invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { writeInvitationOutbox } from "./create-invitation-handler";

export function createResendInvitationHandler(deps: IdentityHandlerDeps) {
  return async (command: ResendInvitationCommand, ctx: RequestContext): Promise<{ queued: true }> => {
    const actor = requireActiveOrg(ctx);
    try {
      if (!InvitationPolicy.canResend(actor.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }
      return await deps.store.transaction(async (store) => {
        const now = deps.clock.now();
        const org = await store.findOrgById(actor.activeOrgId);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());
        const invitation = await store.findInvitationById(command.invitationId);
        if (!invitation || invitation.orgId !== org.id) {
          throw identityAppError(new InvitationStateError("Invitation not found"));
        }
        invitation.markExpiredIfNeeded(now);
        invitation.resend({ newExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), now });
        await store.revokeOutstandingTokens({
          invitationId: invitation.id,
          purpose: "invitation_acceptance",
          now,
        });
        const issued = await deps.tokens.generate();
        const token = OneTimeToken.issueInvitation({
          id: issued.id,
          invitationId: invitation.id,
          orgId: org.id,
          tokenDigest: issued.digest,
          version: invitation.version,
          now,
        });
        await store.updateInvitation(invitation);
        await store.createToken(token);
        await writeInvitationOutbox(deps, store, { invitation, orgName: org.name, rawToken: issued.raw, now });

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "invitation.resent",
            organizationId: org.id,
            actorUserId: actor.userId,
            objectType: "invitation",
            objectId: invitation.id,
            sequence,
            occurredAt: now,
            data: { role: invitation.role },
          }),
        );
        return { queued: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
