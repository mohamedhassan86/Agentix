import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError } from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { LeaveOrganizationCommand } from "../commands/leave-organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { AuthorizationPolicy } from "../policies/authorization-policy";

export function createLeaveOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (_command: LeaveOrganizationCommand, ctx: RequestContext): Promise<{ left: true }> => {
    const actor = requireActiveOrg(ctx);
    try {
      AuthorizationPolicy.assertCanLeave(actor.activeRole);
      return await deps.store.transaction(async (store) => {
        const now = deps.clock.now();
        const org = await store.findOrgById(actor.activeOrgId);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());
        const membership = await store.findActiveMembership(org.id, actor.userId);
        if (!membership) throw identityAppError(new OrganizationNotFoundError());
        membership.end("left", now);
        await store.updateMembership(membership);
        await store.clearActiveOrgForUserInOrg(actor.userId, org.id, now);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "membership.left",
            organizationId: org.id,
            actorUserId: actor.userId,
            subjectUserId: actor.userId,
            objectType: "membership",
            objectId: membership.id,
            sequence,
            occurredAt: now,
            data: { role: membership.role, reason: "left" },
          }),
        );
        return { left: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
