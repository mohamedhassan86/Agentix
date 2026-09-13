import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationNotFoundError, PermissionDeniedError } from "@/domain/identity/errors/identity-errors";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import type { InspectOrganizationQuery } from "../queries/inspect-organization";
import type { OrganizationProfile } from "../dto/organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createInspectOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (query: InspectOrganizationQuery, ctx: RequestContext): Promise<OrganizationProfile> => {
    requireActor(ctx.actor);
    try {
      if (!PlatformPolicy.canInspect(ctx.actor!.isPlatformAdmin)) {
        throw identityAppError(new PermissionDeniedError());
      }
      const org = await deps.store.findOrgById(query.organizationId);
      if (!org) throw identityAppError(new OrganizationNotFoundError());
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        currentRole: null,
        createdAt: org.createdAt.toISOString(),
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
