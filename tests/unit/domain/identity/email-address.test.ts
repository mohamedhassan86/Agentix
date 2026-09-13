import { describe, it, expect } from "vitest";
import { EmailAddress } from "@/domain/identity/value-objects/email-address";

describe("EmailAddress", () => {
  it("normalizes case and trims", () => {
    const email = EmailAddress.create("  Alex@Org.com  ");
    expect(email.normalized).toBe("alex@org.com");
    expect(email.value).toBe("Alex@Org.com");
  });

  it("validates syntax and max length", () => {
    expect(() => EmailAddress.create("invalid")).toThrow();
    expect(() => EmailAddress.create("")).toThrow();
    expect(() => EmailAddress.create("a".repeat(250) + "@test.com")).toThrow();
  });

  it("equals case-insensitively", () => {
    const e1 = EmailAddress.create("Alex@Org.com");
    const e2 = EmailAddress.create("alex@org.com");
    expect(e1.equals(e2)).toBe(true);
  });

  it("rejects whitespace only", () => {
    expect(() => EmailAddress.create("   ")).toThrow();
  });
});
