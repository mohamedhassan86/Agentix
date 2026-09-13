import { describe, it, expect } from "vitest";
import { UserAccount } from "@/domain/identity/entities/user-account";

describe("UserAccount", () => {
  const now = new Date();

  it("registers unverified", () => {
    const user = UserAccount.register({
      id: "0199f000-0000-7000-8000-000000000001",
      emailNormalized: "alex@org.com",
      displayName: "Alex",
      passwordHash: "argon2hash",
      now,
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.isPlatformAdmin).toBe(false);
    expect(user.deletedAt).toBeNull();
  });

  it("marks verified and idempotent already_verified", () => {
    const user = UserAccount.register({
      id: "0199f000-0000-7000-8000-000000000002",
      emailNormalized: "alex@org.com",
      displayName: "Alex",
      passwordHash: "hash",
      now,
    });
    const first = user.markVerified(now);
    expect(first.alreadyVerified).toBe(false);
    expect(user.emailVerifiedAt).not.toBeNull();
    const second = user.markVerified(now);
    expect(second.alreadyVerified).toBe(true);
  });

  it("blocks auth when deleted", () => {
    const user = UserAccount.register({
      id: "0199f000-0000-7000-8000-000000000003",
      emailNormalized: "alex@org.com",
      displayName: "Alex",
      passwordHash: "hash",
      now,
    });
    user.markDeleted(now);
    expect(user.canAuthenticate()).toBe(false);
    expect(() => user.markVerified(now)).toThrow(/DELETED/);
  });

  it("platform admin requires zero memberships", () => {
    const user = UserAccount.register({
      id: "0199f000-0000-7000-8000-000000000004",
      emailNormalized: "admin@org.com",
      displayName: "Admin",
      passwordHash: "hash",
      now,
    });
    expect(() => user.grantPlatformAdmin(1)).toThrow(/ZERO_MEMBERSHIPS/);
    user.grantPlatformAdmin(0);
    expect(user.isPlatformAdmin).toBe(true);
  });
});
