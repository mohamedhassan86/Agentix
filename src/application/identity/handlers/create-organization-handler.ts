import type { RequestContext } from "@/application/shared/context/request-context";
import { Organization } from "@/domain/identity/entities/organization";
import { Membership } from "@/domain/identity/entities/membership";
import { OrganizationSlug } from "@/domain/identity/value-objects/organization-slug";
import { PermissionDeniedError, SlugConflictError } from "@/domain/identity/errors/identity-errors";
import { OrganizationPolicy } from "@/domain/identity/policies/organization-policy";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { CreateOrganizationCommand } from "../commands/create-organization";
import type { OrganizationProfile } from "../dto/organization";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, requireActor, rethrowIdentity } from "../map-error";

export function createCreateOrganizationHandler(deps: IdentityHandlerDeps) {
  return async (command: CreateOrganizationCommand, ctx: RequestContext): Promise<OrganizationProfile> => {
    requireActor(ctx.actor);
    try {
      if (ctx.actor!.isPlatformAdmin || !OrganizationPolicy.canCreateOrganization(ctx.actor!.isPlatformAdmin)) {
        throw identityAppError(new PermissionDeniedError("Platform administrator cannot create an organization"));
      }

      const name = command.name.trim();
      if (!name) throw new ValidationError("Validation failed", { name: ["Name is required"] });

      let slug: OrganizationSlug;
      try {
        slug = command.slug ? OrganizationSlug.create(command.slug) : OrganizationSlug.suggestFromName(name);
      } catch {
        throw new ValidationError("Validation failed", { slug: ["Invalid slug"] });
      }

      return await deps.store.transaction(async (store) => {
        const existing = await store.findOrgBySlug(slug.value);
        if (existing) throw identityAppError(new SlugConflictError());

        const now = deps.clock.now();
        const org = Organization.createNew({
          id: deps.ids.generate(),
          name,
          slug: slug.value,
          ownerUserId: ctx.actor!.userId,
          now,
        });
        const membership = Membership.createActive({
          id: deps.ids.generate(),
          orgId: org.id,
          userId: ctx.actor!.userId,
          role: "owner",
          now,
        });

        await store.createOrg(org);
        await store.createMembership(membership);

        const session = await store.findSessionById(ctx.actor!.sessionId);
        if (session) {
          session.selectOrganization(org.id, now);
          await store.updateSession(session);
        }

        const seq1 = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "organization.created",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            subjectUserId: ctx.actor!.userId,
            objectType: "organization",
            objectId: org.id,
            sequence: seq1,
            occurredAt: now,
            data: { slug: org.slug },
          }),
        );
        const seq2 = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "membership.joined",
            organizationId: org.id,
            actorUserId: ctx.actor!.userId,
            subjectUserId: ctx.actor!.userId,
            objectType: "membership",
            objectId: membership.id,
            sequence: seq2,
            occurredAt: now,
            data: { role: "owner", source: "creation" },
          }),
        );

        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          currentRole: "owner" as const,
          createdAt: org.createdAt.toISOString(),
        };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
