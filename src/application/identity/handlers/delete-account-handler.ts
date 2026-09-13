import type { RequestContext } from "@/application/shared/context/request-context";
import { AccountDeleteBlockedError, OwnerInvariantError } from "@/domain/identity/errors/identity-errors";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { DeleteAccountCommand } from "../commands/delete-account";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { ValidationError } from "@/application/shared/errors/app-error";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createDeleteAccountHandler(deps: IdentityHandlerDeps) {
  return async (command: DeleteAccountCommand, ctx: RequestContext): Promise<{ deleted: true }> => {
    requireActor(ctx.actor);
    try {
      if (command.confirmation !== "DELETE") {
        throw new ValidationError("Validation failed", { confirmation: ["Type DELETE to confirm"] });
      }
      return await deps.store.transaction(async (store) => {
        const user = await store.findUserById(ctx.actor!.userId);
        if (!user || user.isDeleted()) {
          throw identityAppError(new AccountDeleteBlockedError());
        }

        const memberships = await store.listActiveMembershipsByUser(user.id);
        const owned = memberships.filter((m) => m.role === "owner");
        for (const m of owned) {
          const org = await store.findOrgById(m.orgId);
          if (org && !org.isDeleted()) {
            throw identityAppError(new OwnerInvariantError("Cannot delete account while sole Owner of an organization"));
          }
        }

        const now = deps.clock.now();
        user.markDeleted(now);
        await store.updateUser(user);
        await store.endAllActiveMembershipsForUser(user.id, "account_deleted", now);
        await store.revokeAllSessionsForUser(user.id, now);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "account.deleted",
            organizationId: null,
            actorUserId: user.id,
            subjectUserId: user.id,
            objectType: "user",
            objectId: user.id,
            sequence,
            occurredAt: now,
            data: { reason: "self_service" },
          }),
        );

        return { deleted: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
