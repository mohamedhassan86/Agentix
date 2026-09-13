import type { RequestContext } from "@/application/shared/context/request-context";
import { PermissionDeniedError } from "@/domain/identity/errors/identity-errors";
import { InvitationPolicy } from "@/domain/identity/policies/invitation-policy";
import type { ListInvitationsQuery } from "../queries/list-invitations";
import type { InvitationPage } from "../dto/invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { toInvitationDto } from "./invitation-map";

export function createListInvitationsHandler(deps: IdentityHandlerDeps) {
  return async (query: ListInvitationsQuery, ctx: RequestContext): Promise<InvitationPage> => {
    const actor = requireActiveOrg(ctx);
    try {
      if (!InvitationPolicy.canList(actor.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }
      const now = deps.clock.now();
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      const result = await deps.store.listInvitationsByOrg(actor.activeOrgId, { cursor: query.cursor, limit });
      for (const invitation of result.items) {
        if (invitation.markExpiredIfNeeded(now)) {
          await deps.store.updateInvitation(invitation);
        }
      }
      return {
        items: result.items.map((invitation) => toInvitationDto(invitation, now)),
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
