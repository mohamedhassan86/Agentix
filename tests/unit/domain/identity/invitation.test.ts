import { describe, it, expect } from "vitest";
import { Invitation } from "@/domain/identity/entities/invitation";

describe("Invitation", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  it("issues pending and blocks owner role", () => {
    expect(() =>
      Invitation.issue({
        id: "inv1",
        orgId: "org1",
        emailNormalized: "test@example.com",
        role: "owner" as any,
        inviterUserId: "user1",
        expiresAt: future,
        now,
      })
    ).toThrow(/OWNER/);

    const inv = Invitation.issue({
      id: "inv1",
      orgId: "org1",
      emailNormalized: "test@example.com",
      role: "admin",
      inviterUserId: "user1",
      expiresAt: future,
      now,
    });
    expect(inv.status).toBe("pending");
    expect(inv.isPending(now)).toBe(true);
  });

  it("accept transitions", () => {
    const inv = Invitation.issue({
      id: "inv2",
      orgId: "org1",
      emailNormalized: "test@example.com",
      role: "member",
      inviterUserId: "user1",
      expiresAt: future,
      now,
    });
    inv.accept({ userId: "user2", now });
    expect(inv.status).toBe("accepted");
  });

  it("expiry effective", () => {
    const past = new Date(now.getTime() - 1000);
    const inv = Invitation.issue({
      id: "inv3",
      orgId: "org1",
      emailNormalized: "test@example.com",
      role: "viewer",
      inviterUserId: "user1",
      expiresAt: past,
      now,
    });
    expect(inv.getEffectiveStatus(now)).toBe("expired");
    expect(inv.canAccept(now)).toBe(false);
  });

  it("resend invalidates prior and new expiry", () => {
    const inv = Invitation.issue({
      id: "inv4",
      orgId: "org1",
      emailNormalized: "test@example.com",
      role: "member",
      inviterUserId: "user1",
      expiresAt: future,
      now,
    });
    const newFuture = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    inv.resend({ newExpiresAt: newFuture, now });
    expect(inv.status).toBe("pending");
    expect(inv.expiresAt).toBe(newFuture);
  });

  it("revoke only pending", () => {
    const inv = Invitation.issue({
      id: "inv5",
      orgId: "org1",
      emailNormalized: "test@example.com",
      role: "member",
      inviterUserId: "user1",
      expiresAt: future,
      now,
    });
    inv.revoke(now);
    expect(inv.status).toBe("revoked");
    expect(() => inv.revoke(now)).toThrow();
  });
});
