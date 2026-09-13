import { describe, it, expect } from "vitest";
import { OrganizationSlug } from "@/domain/identity/value-objects/organization-slug";

describe("OrganizationSlug", () => {
  it("validates format 3-48 lower alnum hyphen start/end alnum", () => {
    expect(() => OrganizationSlug.create("ab")).toThrow();
    expect(() => OrganizationSlug.create("a".repeat(49))).toThrow();
    expect(() => OrganizationSlug.create("-invalid")).toThrow();
    expect(() => OrganizationSlug.create("invalid-")).toThrow();
    expect(() => OrganizationSlug.create("Valid_Slug")).toThrow();
    const slug = OrganizationSlug.create("valid-slug-123");
    expect(slug.value).toBe("valid-slug-123");
  });

  it("suggests from name via transliteration and collapse", () => {
    const slug = OrganizationSlug.suggestFromName("  Northstar Labs!  ");
    expect(slug.value).toBe("northstar-labs");
  });

  it("suggests handles accents and separators", () => {
    const slug = OrganizationSlug.suggestFromName("Café & Co.");
    expect(slug.value).toMatch(/^[a-z0-9-]+$/);
    expect(slug.value.length).toBeGreaterThanOrEqual(3);
  });

  it("global uniqueness including deleted is enforced in persistence, not here", () => {
    // This test documents that slug uniqueness is DB-level
    const s1 = OrganizationSlug.create("alpha-org");
    const s2 = OrganizationSlug.create("alpha-org");
    expect(s1.equals(s2)).toBe(true);
  });
});
