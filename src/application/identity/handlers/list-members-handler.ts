import type { RequestContext } from "@/application/shared/context/request-context";
import type { ListMembersQuery } from "../queries/list-members";
import type { MemberPage } from "../dto/member";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { rethrowIdentity } from "../map-error";
import { requireActiveOrg } from "../policies/active-org";
import { AuthorizationPolicy } from "../policies/authorization-policy";
import { toMemberDto } from "./member-map";

export function createListMembersHandler(deps: IdentityHandlerDeps) {
  return async (query: ListMembersQuery, ctx: RequestContext): Promise<MemberPage> => {
    const actor = requireActiveOrg(ctx);
    try {
      AuthorizationPolicy.assertCanListMembers(actor.activeRole, actor.isPlatformAdmin);
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      const result = await deps.store.listActiveMembershipsByOrg(actor.activeOrgId, { cursor: query.cursor, limit });
      const roleCounts = await deps.store.countRolesByOrg(actor.activeOrgId);
      return {
        items: result.items.map(toMemberDto),
        roleCounts,
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
