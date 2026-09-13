import type { RequestContext } from "@/application/shared/context/request-context";
import { NoActiveOrganizationError, OrganizationNotFoundError } from "@/domain/identity/errors/identity-errors";
import type { GetActiveOrganizationQuery } from "../queries/get-active-organization";
import type { OrganizationProfile } from "../dto/organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createGetActiveOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (_query: GetActiveOrganizationQuery, ctx: RequestContext): Promise<OrganizationProfile> => {
    requireActor(ctx.actor);
    try {
      if (!ctx.actor!.activeOrgId || !ctx.actor!.activeRole) {
        throw identityAppError(new NoActiveOrganizationError());
      }
      const org = await deps.store.findOrgById(ctx.actor!.activeOrgId);
      if (!org || org.isDeleted()) {
        throw identityAppError(new OrganizationNotFoundError());
      }
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        currentRole: ctx.actor!.activeRole,
        createdAt: org.createdAt.toISOString(),
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
