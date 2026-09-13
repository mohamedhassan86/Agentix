import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError, PermissionDeniedError } from "@/domain/identity/errors/identity-errors";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import type { InspectInvitationsQuery } from "../queries/inspect-invitations";
import type { InvitationPage } from "../dto/invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";
import { toInvitationDto } from "./invitation-map";

export function createInspectInvitationsHandler(deps: IdentityHandlerDeps) {
  return async (query: InspectInvitationsQuery, ctx: RequestContext): Promise<InvitationPage> => {
    requireActor(ctx.actor);
    try {
      if (!PlatformPolicy.canInspect(ctx.actor!.isPlatformAdmin)) {
        throw identityAppError(new PermissionDeniedError());
      }
      const org = await deps.store.findOrgById(query.organizationId);
      if (!org) throw identityAppError(new OrganizationNotFoundError());
      const now = deps.clock.now();
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      const result = await deps.store.listInvitationsByOrg(org.id, { cursor: query.cursor, limit });
      return { items: result.items.map((i) => toInvitationDto(i, now)), nextCursor: result.nextCursor };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
