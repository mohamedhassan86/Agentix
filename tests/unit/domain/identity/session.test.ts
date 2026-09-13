import { describe, it, expect } from "vitest";
import { Session } from "@/domain/identity/entities/session";

describe("Session", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  it("starts with null active org", () => {
    const digest = new Uint8Array([1, 2, 3]);
    const session = Session.start({
      id: "s1",
      sessionTokenDigest: digest,
      userId: "user1",
      expiresAt: future,
      now,
    });
    expect(session.activeOrgId).toBeNull();
    expect(session.isValid(now)).toBe(true);
  });

  it("selects organization and clears", () => {
    const digest = new Uint8Array([1, 2, 3]);
    const session = Session.start({
      id: "s2",
      sessionTokenDigest: digest,
      userId: "user1",
      expiresAt: future,
      now,
    });
    session.selectOrganization("org1", now);
    expect(session.activeOrgId).toBe("org1");
    session.clearOrganization(now);
    expect(session.activeOrgId).toBeNull();
  });

  it("revokes and invalidates", () => {
    const digest = new Uint8Array([1, 2, 3]);
    const session = Session.start({
      id: "s3",
      sessionTokenDigest: digest,
      userId: "user1",
      expiresAt: future,
      now,
    });
    session.revoke(now);
    expect(session.isValid(now)).toBe(false);
    expect(() => session.selectOrganization("org1", now)).toThrow();
  });
});
