/**
 * OrganizationSlug value object
 * 3-48 chars, lowercase ASCII letters, digits, hyphens, starts/ends alnum
 */

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;
const MIN_LENGTH = 3;
const MAX_LENGTH = 48;

export class OrganizationSlug {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(input: string): OrganizationSlug {
    if (typeof input !== "string") {
      throw new Error("SLUG_INVALID");
    }
    const trimmed = input.trim().toLowerCase();
    if (trimmed.length < MIN_LENGTH) {
      throw new Error("SLUG_TOO_SHORT");
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new Error("SLUG_TOO_LONG");
    }
    if (!SLUG_REGEX.test(trimmed)) {
      throw new Error("SLUG_INVALID_FORMAT");
    }
    return new OrganizationSlug(trimmed);
  }

  /** Suggest slug from organization name: lowercase, transliterate, collapse separators, trim, cap */
  static suggestFromName(name: string): OrganizationSlug {
    if (typeof name !== "string" || name.trim().length === 0) {
      throw new Error("NAME_REQUIRED_FOR_SLUG");
    }
    let slug = name.trim().toLowerCase();
    // Basic transliteration: remove accents via NFD
    slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Replace any non-alnum with hyphen
    slug = slug.replace(/[^a-z0-9]+/g, "-");
    // Collapse multiple hyphens
    slug = slug.replace(/-+/g, "-");
    // Trim hyphens
    slug = slug.replace(/^-+/, "").replace(/-+$/, "");
    // Length cap 48
    if (slug.length > MAX_LENGTH) {
      slug = slug.substring(0, MAX_LENGTH).replace(/-+$/, "");
    }
    // Ensure min 3, pad with random? Instead, if too short, keep as is and validation will fail later, but we try to ensure at least 3 by appending
    if (slug.length < MIN_LENGTH) {
      // If empty after sanitization, use generic prefix
      if (slug.length === 0) {
        slug = "org";
      }
      // Pad to min length with '0's (user must confirm uniqueness transactionally)
      while (slug.length < MIN_LENGTH) {
        slug += "-0";
        if (slug.length > MAX_LENGTH) break;
      }
    }
    // Ensure starts/ends alnum
    slug = slug.replace(/^-+/, "").replace(/-+$/, "");
    if (slug.length < MIN_LENGTH) {
      slug = `org-${slug}`;
    }
    // Final validation - if still invalid, fallback to org + timestamp fragment (deterministic enough for suggestion, availability not reserved)
    if (!SLUG_REGEX.test(slug) || slug.length < MIN_LENGTH || slug.length > MAX_LENGTH) {
      // Fallback: generate from name hash? Use simple prefix + random? Keep deterministic fallback
      const fallback = `org-${Date.now().toString(36).slice(-6)}`;
      if (SLUG_REGEX.test(fallback)) {
        return new OrganizationSlug(fallback);
      }
      return new OrganizationSlug("org");
    }
    return new OrganizationSlug(slug);
  }

  get value(): string {
    return this._value;
  }

  equals(other: OrganizationSlug): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
