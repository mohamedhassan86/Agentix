import type { RequestContext } from "@/application/shared/context/request-context";
import {
  NoActiveOrganizationError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from "@/domain/identity/errors/identity-errors";
import { OrganizationPolicy } from "@/domain/identity/policies/organization-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { DeleteOrganizationCommand } from "../commands/delete-organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createDeleteOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (command: DeleteOrganizationCommand, ctx: RequestContext): Promise<{ deleted: true }> => {
    requireActor(ctx.actor);
    try {
      if (!ctx.actor!.activeOrgId || !ctx.actor!.activeRole) {
        throw identityAppError(new NoActiveOrganizationError());
      }
      if (!OrganizationPolicy.canDelete(ctx.actor!.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }

      return await deps.store.transaction(async (store) => {
        const org = await store.findOrgById(ctx.actor!.activeOrgId!);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());
        org.verifyDeletionConfirmation(command.confirmationSlug);
        const now = deps.clock.now();
        org.markDeleted(now);
        await store.updateOrg(org);
        await store.endAllActiveMembershipsForOrg(org.id, "organization_deleted", now);
        await store.revokePendingInvitationsForOrg(org.id, now);
        await store.clearActiveOrgForOrg(org.id, now);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "organization.deleted",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            objectType: "organization",
            objectId: org.id,
            sequence,
            occurredAt: now,
            data: { slug: org.slug, reason: "owner_confirmed" },
          }),
        );
        return { deleted: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
