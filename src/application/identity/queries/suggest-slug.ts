export const SUGGEST_SLUG_TYPE = "identity.organization.suggestSlug";

export interface SuggestSlugQuery {
  type: typeof SUGGEST_SLUG_TYPE;
  name: string;
}
