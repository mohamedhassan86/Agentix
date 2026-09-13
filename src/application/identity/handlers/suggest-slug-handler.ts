import type { RequestContext } from "@/application/shared/context/request-context";
import { OrganizationSlug } from "@/domain/identity/value-objects/organization-slug";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { SuggestSlugQuery } from "../queries/suggest-slug";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor } from "../map-error";

export function createSuggestSlugHandler(_deps: IdentityHandlerDeps) {
  return async (query: SuggestSlugQuery, ctx: RequestContext): Promise<{ slug: string }> => {
    requireActor(ctx.actor);
    try {
      const slug = OrganizationSlug.suggestFromName(query.name);
      return { slug: slug.value };
    } catch {
      throw new ValidationError("Validation failed", { name: ["A name is required to suggest a slug"] });
    }
  };
}
