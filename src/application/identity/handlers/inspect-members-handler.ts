import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError, PermissionDeniedError } from "@/domain/identity/errors/identity-errors";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import type { InspectMembersQuery } from "../queries/inspect-members";
import type { MemberPage } from "../dto/member";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";
import { clampPageLimit } from "../queries/page-limit";
import { toMemberDto } from "./member-map";

export function createInspectMembersHandler(deps: IdentityHandlerDeps) {
  return async (query: InspectMembersQuery, ctx: RequestContext): Promise<MemberPage> => {
    requireActor(ctx.actor);
    try {
      if (!PlatformPolicy.canInspect(ctx.actor!.isPlatformAdmin)) {
        throw identityAppError(new PermissionDeniedError());
      }
      const org = await deps.store.findOrgById(query.organizationId);
      if (!org) throw identityAppError(new OrganizationNotFoundError());
      const limit = clampPageLimit(query.limit);
      const result = await deps.store.listActiveMembershipsByOrg(org.id, { cursor: query.cursor, limit });
      const roleCounts = await deps.store.countRolesByOrg(org.id);
      return {
        items: result.items.map(toMemberDto),
        roleCounts: roleCounts as MemberPage["roleCounts"],
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
