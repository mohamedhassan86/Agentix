import type { RequestContext } from "@/application/shared/context/request-context";
import type { ListMyOrganizationsQuery } from "../queries/list-my-organizations";
import type { OrganizationPage } from "../dto/organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor, rethrowIdentity } from "../map-error";

export function createListMyOrganizationsHandler(deps: IdentityHandlerDeps) {
  return async (query: ListMyOrganizationsQuery, ctx: RequestContext): Promise<OrganizationPage> => {
    requireActor(ctx.actor);
    try {
      const limit = Math.min(Math.max(query.limit ?? 25, 1), 100);
      const result = await deps.store.listOrgsForUser(ctx.actor!.userId, { cursor: query.cursor, limit });
      return {
        items: result.items.map((row) => ({
          id: row.organization.id,
          name: row.organization.name,
          slug: row.organization.slug,
          currentRole: row.membership.role,
          createdAt: row.organization.createdAt.toISOString(),
        })),
        nextCursor: result.nextCursor,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
