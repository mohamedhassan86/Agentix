import { describe, it, expect } from "vitest";
import { Membership } from "@/domain/identity/entities/membership";

describe("Membership", () => {
  const now = new Date();

  it("creates active and owner check", () => {
    const m = Membership.createActive({
      id: "m1",
      orgId: "org1",
      userId: "user1",
      role: "owner",
      now,
    });
    expect(m.isActive()).toBe(true);
    expect(m.isOwner()).toBe(true);
    expect(m.canBeRemoved()).toBe(false);
    expect(m.canLeave()).toBe(false);
  });

  it("role change blocks owner", () => {
    const m = Membership.createActive({
      id: "m2",
      orgId: "org1",
      userId: "user1",
      role: "admin",
      now,
    });
    m.changeRole("member", now);
    expect(m.role).toBe("member");
    expect(() => m.changeRole("owner" as any, now)).toThrow();
  });

  it("owner cannot be changed via general", () => {
    const m = Membership.createActive({
      id: "m3",
      orgId: "org1",
      userId: "user1",
      role: "owner",
      now,
    });
    expect(() => m.changeRole("admin", now)).toThrow();
  });

  it("end and reactivate", () => {
    const m = Membership.createActive({
      id: "m4",
      orgId: "org1",
      userId: "user1",
      role: "member",
      now,
    });
    m.end("left", now);
    expect(m.isActive()).toBe(false);
    m.reactivate("admin", now);
    expect(m.isActive()).toBe(true);
    expect(m.role).toBe("admin");
  });
});
