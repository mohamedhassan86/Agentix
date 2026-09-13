import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError, OwnerInvariantError } from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { ChangeMemberRoleCommand } from "../commands/change-member-role";
import type { Member } from "../dto/member";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { AuthorizationPolicy } from "../policies/authorization-policy";

export function createChangeMemberRoleHandler(deps: IdentityHandlerDeps) {
  return async (command: ChangeMemberRoleCommand, ctx: RequestContext): Promise<Member> => {
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
        AuthorizationPolicy.assertCanChangeRole(actor.activeRole, membership.role, command.role);
        const previousRole = membership.role;
        membership.changeRole(command.role, now);
        await store.updateMembership(membership);
        const user = await store.findUserById(membership.userId);
        if (!user) throw identityAppError(new OrganizationNotFoundError());

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "membership.role_changed",
            organizationId: org.id,
            actorUserId: actor.userId,
            subjectUserId: membership.userId,
            objectType: "membership",
            objectId: membership.id,
            sequence,
            occurredAt: now,
            data: { from: previousRole, to: membership.role },
          }),
        );

        return {
          id: membership.id,
          userId: user.id,
          displayName: user.displayName,
          email: user.emailNormalized,
          role: membership.role,
          joinedAt: membership.joinedAt.toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Error && error.message === "OWNER_ROLE_MUST_USE_TRANSFER") {
        throw identityAppError(new OwnerInvariantError());
      }
      rethrowIdentity(error);
    }
  };
}
