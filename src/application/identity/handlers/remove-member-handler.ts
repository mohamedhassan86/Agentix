import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError } from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { RemoveMemberCommand } from "../commands/remove-member";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { AuthorizationPolicy } from "../policies/authorization-policy";

export function createRemoveMemberHandler(deps: IdentityHandlerDeps) {
  return async (command: RemoveMemberCommand, ctx: RequestContext): Promise<{ removed: true }> => {
    const actor = requireActiveOrg(ctx);
    try {
      return await deps.store.transaction(async (store) => {
        const now = deps.clock.now();
        const org = await store.findOrgById(actor.activeOrgId);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());
        const membership = await store.findMembershipById(command.memberId);
        if (!membership || membership.orgId !== org.id || !membership.isActive()) {
          throw identityAppError(new OrganizationNotFoundError());
        }
        AuthorizationPolicy.assertCanRemove(actor.activeRole, membership.role);
        membership.end("removed", now);
        await store.updateMembership(membership);
        await store.clearActiveOrgForUserInOrg(membership.userId, org.id, now);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "membership.removed",
            organizationId: org.id,
            actorUserId: actor.userId,
            subjectUserId: membership.userId,
            objectType: "membership",
            objectId: membership.id,
            sequence,
            occurredAt: now,
            data: { role: membership.role, reason: "removed" },
          }),
        );
        return { removed: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
