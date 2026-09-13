import { describe, it, expect } from "vitest";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { Invitation } from "@/domain/identity/entities/invitation";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";

describe("invitation lifecycle persistence", () => {
  it("stores digest only and materializes expiry independently of deliveryState", async () => {
    const harness = createIdentityHarness();
    const now = harness.clock.now();
    const invitation = Invitation.issue({
      id: harness.deps.ids.generate(),
      orgId: harness.deps.ids.generate(),
      emailNormalized: "a@example.test",
      role: "member",
      inviterUserId: harness.deps.ids.generate(),
      expiresAt: new Date(now.getTime() - 1000),
      now,
    });
    invitation.markDelivery("failed", "PROVIDER_TIMEOUT", now);
    const token = OneTimeToken.issueInvitation({
      id: harness.deps.ids.generate(),
      invitationId: invitation.id,
      orgId: invitation.orgId,
      tokenDigest: new Uint8Array(32).fill(7),
      version: 1,
      now,
    });
    await harness.store.createInvitation(invitation);
    await harness.store.createToken(token);
    await harness.store.materializeExpiredPending(invitation.orgId, invitation.emailNormalized, now);
    const stored = await harness.store.findInvitationById(invitation.id);
    expect(stored?.status).toBe("expired");
    expect(stored?.deliveryState).toBe("failed");
    const storedToken = await harness.store.findLatestTokenByInvitation(invitation.id);
    expect(storedToken?.tokenDigest).toBeInstanceOf(Uint8Array);
  });
});
