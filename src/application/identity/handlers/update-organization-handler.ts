import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationSlug } from "@/domain/identity/value-objects/organization-slug";
import {
  NoActiveOrganizationError,
  OrganizationNotFoundError,
  PermissionDeniedError,
  SlugConflictError,
} from "@/domain/identity/errors/identity-errors";
import { OrganizationPolicy } from "@/domain/identity/policies/organization-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { UpdateOrganizationCommand } from "../commands/update-organization";
import type { OrganizationProfile } from "../dto/organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createUpdateOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (command: UpdateOrganizationCommand, ctx: RequestContext): Promise<OrganizationProfile> => {
    requireActor(ctx.actor);
    try {
      if (!ctx.actor!.activeOrgId || !ctx.actor!.activeRole) {
        throw identityAppError(new NoActiveOrganizationError());
      }
      if (!OrganizationPolicy.canRename(ctx.actor!.activeRole) && !OrganizationPolicy.canChangeSlug(ctx.actor!.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }
      if (command.slug && !OrganizationPolicy.canChangeSlug(ctx.actor!.activeRole)) {
        throw identityAppError(new PermissionDeniedError());
      }

      return await deps.store.transaction(async (store) => {
        const org = await store.findOrgById(ctx.actor!.activeOrgId!);
        if (!org || org.isDeleted()) throw identityAppError(new OrganizationNotFoundError());

        const now = deps.clock.now();
        const previousSlug = org.slug;
        let nextSlug: string | undefined;
        if (command.slug) {
          try {
            nextSlug = OrganizationSlug.create(command.slug).value;
          } catch {
            throw new ValidationError("Validation failed", { slug: ["Invalid slug"] });
          }
          if (nextSlug !== previousSlug) {
            const clash = await store.findOrgBySlug(nextSlug);
            if (clash && clash.id !== org.id) throw identityAppError(new SlugConflictError());
          }
        }
        org.rename({ name: command.name, slug: nextSlug, now });
        await store.updateOrg(org);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "organization.profile_changed",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            objectType: "organization",
            objectId: org.id,
            sequence,
            occurredAt: now,
            data: {
              fields: [command.name ? "name" : null, nextSlug ? "slug" : null].filter(Boolean),
              oldSlug: previousSlug,
              newSlug: org.slug,
            },
          }),
        );

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          currentRole: ctx.actor!.activeRole,
          createdAt: org.createdAt.toISOString(),
        };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
