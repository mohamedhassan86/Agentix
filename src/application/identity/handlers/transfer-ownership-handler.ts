import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError, OwnerInvariantError } from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { TransferOwnershipCommand } from "../commands/transfer-ownership";
import type { OwnershipTransferResult } from "../dto/member";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { AuthorizationPolicy } from "../policies/authorization-policy";

export function createTransferOwnershipHandler(deps: IdentityHandlerDeps) {
  return async (command: TransferOwnershipCommand, ctx: RequestContext): Promise<OwnershipTransferResult> => {
    const actor = requireActiveOrg(ctx);
    try {
      if (command.confirmation !== "TRANSFER") {
        throw new ValidationError("Validation failed", { confirmation: ["Type TRANSFER to confirm"] });
      }
      AuthorizationPolicy.assertCanTransfer(actor.activeRole);
      return await deps.store.withOrgLock(actor.activeOrgId, () =>
        deps.store.transaction(async (store) => {
        const now = deps.clock.now();
        const org = await store.findOrgById(actor.activeOrgId);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());
        const currentOwner = await store.findActiveMembership(org.id, actor.userId);
        const target = await store.findMembershipById(command.targetMemberId);
        if (!currentOwner || currentOwner.role !== "owner") {
          throw identityAppError(new OwnerInvariantError());
        }
        if (!target || target.orgId !== org.id || !target.isActive() || target.role === "owner") {
          throw identityAppError(new OwnerInvariantError("Transfer target must be an active non-Owner member"));
        }

        currentOwner.demoteToAdmin(now);
        target.transferToOwner(now);
        org.transferOwnership({ newOwnerUserId: target.userId, now });
        await store.updateMembership(currentOwner);
        await store.updateMembership(target);
        await store.updateOrg(org);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "organization.ownership_transferred",
            organizationId: org.id,
            actorUserId: actor.userId,
            subjectUserId: target.userId,
            objectType: "organization",
            objectId: org.id,
            sequence,
            occurredAt: now,
            data: { fromMembershipId: currentOwner.id, toMembershipId: target.id },
          }),
        );

        const formerUser = await store.findUserById(currentOwner.userId);
        const newUser = await store.findUserById(target.userId);
        if (!formerUser || !newUser) throw identityAppError(new OrganizationNotFoundError());

        return {
          owner: {
            id: target.id,
            userId: newUser.id,
            displayName: newUser.displayName,
            email: newUser.emailNormalized,
            role: target.role,
            joinedAt: target.joinedAt.toISOString(),
          },
          formerOwner: {
            id: currentOwner.id,
            userId: formerUser.id,
            displayName: formerUser.displayName,
            email: formerUser.emailNormalized,
            role: currentOwner.role,
            joinedAt: currentOwner.joinedAt.toISOString(),
          },
        };
        }),
      );
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
