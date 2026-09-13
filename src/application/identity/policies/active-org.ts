import type { IdentityActor, RequestContext } from "@/application/shared/context/request-context";
import type { OrganizationRole } from "@/domain/identity/value-objects/organization-role";
import { NoActiveOrganizationError } from "@/domain/identity/errors/identity-errors";
import { identityAppError, requireActor } from "../map-error";

export type ActiveActor = IdentityActor & { activeOrgId: string; activeRole: OrganizationRole };

export function requireActiveOrg(ctx: RequestContext): ActiveActor {
  requireActor(ctx.actor);
  if (!ctx.actor.activeOrgId || !ctx.actor.activeRole) {
    throw identityAppError(new NoActiveOrganizationError());
  }
  return ctx.actor as ActiveActor;
}
