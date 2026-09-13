import type { RequestContext } from "@/application/shared/context/request-context";
import {
  FormerMemberError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from "@/domain/identity/errors/identity-errors";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import { TenantIsolationPolicy } from "@/domain/identity/policies/tenant-isolation-policy";
import type { SwitchActiveOrganizationCommand } from "../commands/switch-active-organization";
import type { SessionContext } from "../dto/sign-in";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createSwitchActiveOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (command: SwitchActiveOrganizationCommand, ctx: RequestContext): Promise<SessionContext> => {
    requireActor(ctx.actor);
    try {
      if (!PlatformPolicy.canSwitchOrganization(ctx.actor!.isPlatformAdmin)) {
        throw identityAppError(new PermissionDeniedError());
      }
      const now = deps.clock.now();
      const org = await deps.store.findOrgById(command.organizationId);
      const anyMembership = await deps.store.findAnyMembership(command.organizationId, ctx.actor!.userId);
      const access = TenantIsolationPolicy.evaluate({
        hasCurrentMembership: Boolean(anyMembership?.isActive() && org && !org.isDeleted()),
        hasFormerMembership: Boolean(anyMembership && !anyMembership.isActive()),
        isPlatformAdmin: ctx.actor!.isPlatformAdmin,
        hasActiveOrg: true,
        isPlatformInspectRoute: false,
      });
      if (!access.allowed) {
        if (access.code === "FORMER_MEMBER") throw identityAppError(new FormerMemberError());
        if (access.code === "PERMISSION_DENIED") throw identityAppError(new PermissionDeniedError());
        throw identityAppError(new OrganizationNotFoundError());
      }
      if (!org || org.isDeleted() || !anyMembership?.isActive()) {
        throw identityAppError(new OrganizationNotFoundError());
      }
      const session = await deps.store.findSessionById(ctx.actor!.sessionId);
      if (!session) throw identityAppError(new OrganizationNotFoundError());
      session.selectOrganization(org.id, now);
      await deps.store.updateSession(session);
      return {
        userId: ctx.actor!.userId,
        activeOrganizationId: org.id,
        activeRole: anyMembership.role,
        platformAdministrator: false,
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
