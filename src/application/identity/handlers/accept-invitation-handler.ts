import type { RequestContext } from "@/application/shared/context/request-context";
import { Membership } from "@/domain/identity/entities/membership";
import {
  InvitationConflictError,
  InvitationEmailMismatchError,
  InvitationStateError,
  OrganizationNotFoundError,
  TokenInvalidError,
} from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { parseRawTokenFormat } from "@/domain/identity/value-objects/opaque-token-digest";
import type { AcceptInvitationCommand } from "../commands/accept-invitation";
import type { InvitationAcceptanceResult } from "../dto/invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createAcceptInvitationHandler(deps: IdentityHandlerDeps) {
  return async (command: AcceptInvitationCommand, ctx: RequestContext): Promise<InvitationAcceptanceResult> => {
    requireActor(ctx.actor);
    try {
      let parsed: { id: string; secret: string };
      try {
        parsed = parseRawTokenFormat(command.token);
      } catch {
        throw identityAppError(new TokenInvalidError());
      }
      const candidateDigest = await deps.tokens.digestSecret(parsed.secret);

      return await deps.store.transaction(async (store) => {
        const now = deps.clock.now();
        const token = await store.findTokenById(parsed.id);
        if (!token || token.purpose !== "invitation_acceptance" || token.invitationId !== command.invitationId) {
          throw identityAppError(new TokenInvalidError());
        }
        if (!deps.tokens.verifyDigest(token.tokenDigest, candidateDigest)) {
          throw identityAppError(new TokenInvalidError());
        }
        if (!token.isValid(now)) throw identityAppError(new TokenInvalidError());

        const invitation = await store.findInvitationById(command.invitationId);
        if (!invitation) throw identityAppError(new TokenInvalidError());
        invitation.markExpiredIfNeeded(now);
        if (invitation.emailNormalized !== ctx.actor!.emailNormalized) {
          throw identityAppError(new InvitationEmailMismatchError());
        }
        if (ctx.actor!.isPlatformAdmin) {
          throw identityAppError(new InvitationConflictError("Cannot invite platform administrator"));
        }

        const org = await store.findOrgById(invitation.orgId);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());

        const existingActive = await store.findActiveMembership(org.id, ctx.actor!.userId);
        if (existingActive) throw identityAppError(new InvitationConflictError("User is already a member"));

        invitation.accept({ userId: ctx.actor!.userId, now });
        token.consume(now);

        const previous = await store.findAnyMembership(org.id, ctx.actor!.userId);
        let membership = previous;
        if (previous && !previous.isActive()) {
          previous.reactivate(invitation.role, now);
          await store.updateMembership(previous);
          membership = previous;
        } else {
          membership = Membership.createActive({
            id: deps.ids.generate(),
            orgId: org.id,
            userId: ctx.actor!.userId,
            role: invitation.role,
            now,
          });
          await store.createMembership(membership);
        }

        await store.updateInvitation(invitation);
        await store.updateToken(token);

        const seq1 = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "invitation.accepted",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            subjectUserId: ctx.actor!.userId,
            objectType: "invitation",
            objectId: invitation.id,
            sequence: seq1,
            occurredAt: now,
            data: { role: invitation.role },
          }),
        );
        const seq2 = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "membership.joined",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            subjectUserId: ctx.actor!.userId,
            objectType: "membership",
            objectId: membership!.id,
            sequence: seq2,
            occurredAt: now,
            data: { role: invitation.role, source: "invitation" },
          }),
        );

        const user = await store.findUserById(ctx.actor!.userId);
        if (!user) throw identityAppError(new InvitationStateError());

        return {
          membership: {
            id: membership!.id,
            userId: user.id,
            displayName: user.displayName,
            email: user.emailNormalized,
            role: membership!.role,
            joinedAt: membership!.joinedAt.toISOString(),
          },
          activeOrganizationChanged: false as const,
        };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
