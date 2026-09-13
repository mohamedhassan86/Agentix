import type { RequestContext } from "@/application/shared/context/request-context";
import { Invitation } from "@/domain/identity/entities/invitation";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import { EmailAddress } from "@/domain/identity/value-objects/email-address";
import {
  InvitationConflictError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from "@/domain/identity/errors/identity-errors";
import { InvitationPolicy } from "@/domain/identity/policies/invitation-policy";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { CreateInvitationCommand } from "../commands/create-invitation";
import type { Invitation as InvitationDto } from "../dto/invitation";
import type { IdentityHandlerDeps, IdentityStore } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { invitationActionUrl, outboxAad, recipientHash } from "../crypto-util";
import { requireActiveOrg } from "../policies/active-org";
import { toInvitationDto } from "./invitation-map";

async function writeInvitationOutbox(
  deps: IdentityHandlerDeps,
  store: IdentityStore,
  params: { invitation: Invitation; orgName: string; rawToken: string; now: Date },
): Promise<void> {
  const outboxId = deps.ids.generate();
  const recHash = recipientHash(params.invitation.emailNormalized);
  const keyVersion = deps.deliveryKeyVersion;
  const aad = outboxAad({
    outboxId,
    messageKind: "invitation",
    recipientHash: recHash,
    keyVersion,
  });
  const actionUrl = invitationActionUrl(deps.origin, params.invitation.id, params.rawToken);
  const plaintext = JSON.stringify({
    recipient: params.invitation.emailNormalized,
    template: "organization-invitation",
    parameters: {
      organizationName: params.orgName,
      role: params.invitation.role,
      actionUrl,
      expiresAt: params.invitation.expiresAt.toISOString(),
    },
  });
  const encrypted = await deps.encryption.encrypt(plaintext, aad, keyVersion);
  await store.writeEncryptedOutbox({
    id: outboxId,
    workType: "identity.invitation",
    orgId: params.invitation.orgId,
    messageKind: "invitation",
    recipientHash: recHash,
    ciphertext: encrypted.ciphertext,
    nonce: encrypted.nonce,
    tag: encrypted.tag,
    keyVersion,
    status: "pending",
    availableAt: params.now,
    attemptCount: 0,
    lastErrorCode: null,
    capturedActionUrl: actionUrl,
    capturedRecipient: params.invitation.emailNormalized,
    capturedTemplate: "organization-invitation",
  });
}

export function createCreateInvitationHandler(deps: IdentityHandlerDeps) {
  return async (command: CreateInvitationCommand, ctx: RequestContext): Promise<InvitationDto> => {
    const actor = requireActiveOrg(ctx);
    try {
      if (!InvitationPolicy.canIssue(actor.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }
      if (!InvitationPolicy.isInvitableRole(command.role)) {
        throw identityAppError(new InvitationConflictError("Cannot invite as Owner"));
      }
      let email: EmailAddress;
      try {
        email = EmailAddress.create(command.email);
      } catch {
        throw new ValidationError("Validation failed", { email: ["Invalid email"] });
      }

      return await deps.store.transaction(async (store) => {
          const now = deps.clock.now();
          const org = await store.findOrgById(actor.activeOrgId);
          if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());

          await store.materializeExpiredPending(org.id, email.normalized, now);

          const targetUser = await store.findUserByEmailNormalized(email.normalized);
          if (targetUser?.isPlatformAdmin || (targetUser && !PlatformPolicy.canBeInvited(targetUser.isPlatformAdmin))) {
            throw identityAppError(new InvitationConflictError("Cannot invite platform administrator"));
          }
          if (targetUser) {
            const existing = await store.findActiveMembership(org.id, targetUser.id);
            if (existing) throw identityAppError(new InvitationConflictError("User is already a member"));
          }

          const pending = await store.findPendingInvitation(org.id, email.normalized);
          if (pending) throw identityAppError(new InvitationConflictError("Pending invitation already exists"));

          const invitation = Invitation.issue({
            id: deps.ids.generate(),
            orgId: org.id,
            emailNormalized: email.normalized,
            role: command.role,
            inviterUserId: actor.userId,
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            now,
          });
          const issued = await deps.tokens.generate();
          const token = OneTimeToken.issueInvitation({
            id: issued.id,
            invitationId: invitation.id,
            orgId: org.id,
            tokenDigest: issued.digest,
            version: 1,
            now,
          });

          await store.createInvitation(invitation);
          await store.createToken(token);
          await writeInvitationOutbox(deps, store, { invitation, orgName: org.name, rawToken: issued.raw, now });

          const sequence = await store.nextEventSequence();
          await store.appendEvent(
            createIdentityEvent({
              eventId: deps.ids.generate(),
              eventType: "invitation.created",
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

export { writeInvitationOutbox };
