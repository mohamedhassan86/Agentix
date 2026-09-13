import type { RequestContext } from "@/application/shared/context/request-context";
import {
  InvitationStateError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from "@/domain/identity/errors/identity-errors";
import { InvitationPolicy } from "@/domain/identity/policies/invitation-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { RevokeInvitationCommand } from "../commands/revoke-invitation";
import type { Invitation as InvitationDto } from "../dto/invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { toInvitationDto } from "./invitation-map";

export function createRevokeInvitationHandler(deps: IdentityHandlerDeps) {
  return async (command: RevokeInvitationCommand, ctx: RequestContext): Promise<InvitationDto> => {
    const actor = requireActiveOrg(ctx);
    try {
      if (!InvitationPolicy.canRevoke(actor.activeRole)) {
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
        invitation.revoke(now);
        await store.updateInvitation(invitation);
        await store.revokeOutstandingTokens({
          invitationId: invitation.id,
          purpose: "invitation_acceptance",
          now,
        });
        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "invitation.revoked",
            organizationId: org.id,
            actorUserId: actor.userId,
            objectType: "invitation",
            objectId: invitation.id,
            sequence,
            occurredAt: now,
            data: { role: invitation.role },
          }),
        );
        return toInvitationDto(invitation, now);
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
