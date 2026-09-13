import type { RequestContext } from "@/application/shared/context/request-context";
import type { GetSessionContextQuery } from "../queries/get-session-context";
import type { SessionContext } from "../dto/sign-in";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor, rethrowIdentity } from "../map-error";

export function createGetSessionContextHandler(_deps: IdentityHandlerDeps) {
  return async (_query: GetSessionContextQuery, ctx: RequestContext): Promise<SessionContext> => {
    requireActor(ctx.actor);
    try {
      return {
        userId: ctx.actor!.userId,
        activeOrganizationId: ctx.actor!.activeOrgId,
        activeRole: ctx.actor!.activeRole,
        platformAdministrator: ctx.actor!.isPlatformAdmin,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
