import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { createRequestContext } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { IDENTITY_EVENT_TYPES, createIdentityEvent } from "@/domain/identity/events/identity-events";
import { createIdentityHarness } from "../../helpers/identity-harness";

const CATALOG_TYPES = [
  "account.registered",
  "account.email_verified",
  "account.deleted",
  "organization.created",
  "organization.profile_changed",
  "organization.ownership_transferred",
  "organization.deleted",
  "membership.joined",
  "membership.role_changed",
  "membership.removed",
  "membership.left",
  "invitation.created",
  "invitation.resent",
  "invitation.revoked",
  "invitation.expired",
  "invitation.accepted",
  "message.delivery_succeeded",
  "message.delivery_failed",
];

describe("identity event catalog", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  it("contracts/events.md lists the closed catalog with redacted payloads", () => {
    const md = readFileSync("specs/002-tenancy-identity/contracts/events.md", "utf-8");
    for (const type of CATALOG_TYPES) {
      expect(md).toContain(`\`${type}\``);
    }
    expect(md).toMatch(/MUST NOT contain password/);
    expect(md).toMatch(/idempotent by `eventId`/);
    expect(md).toMatch(/\(organizationId, sequence\)/);
  });

  it("domain catalog matches events.md and rejects secret fields", () => {
    expect([...IDENTITY_EVENT_TYPES].sort()).toEqual([...CATALOG_TYPES].sort());
    expect(() =>
      createIdentityEvent({
        eventId: "0199f000-0000-7000-8000-000000000099",
        eventType: "account.registered",
        objectType: "user",
        objectId: "0199f000-0000-7000-8000-000000000001",
        sequence: 1,
        occurredAt: new Date(),
        data: { password: "supersecret" },
      }),
    ).toThrow(/password/);
  });

  it("register emits redacted events with monotonic sequence and unique eventId", async () => {
    const handle = createRegisterAccountHandler(harness.deps);
    const ctx = createRequestContext({ correlationId: "0199f000-0000-7000-8000-000000000010" });
    await handle(
      { type: REGISTER_ACCOUNT_TYPE, email: "one@example.test", displayName: "One", password: "supersecret-password" },
      ctx,
    );
    await handle(
      { type: REGISTER_ACCOUNT_TYPE, email: "two@example.test", displayName: "Two", password: "supersecret-password" },
      ctx,
    );

    const events = harness.store.events;
    expect(events.length).toBeGreaterThanOrEqual(2);
    const ids = new Set(events.map((e) => e.eventId));
    expect(ids.size).toBe(events.length);
    const sequences = events.map((e) => Number(e.sequence));
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    const json = JSON.stringify(events);
    expect(json).not.toContain("supersecret-password");
    expect(json).not.toMatch(/passwordHash|tokenDigest|sessionToken|ciphertext/);
    for (const event of events) {
      expect(event.eventVersion).toBe(1);
      expect(event.data).not.toHaveProperty("email");
      expect(event.data).not.toHaveProperty("token");
    }

    const outboxMeta = [...harness.store.outbox.values()].map((r) => ({
      messageKind: r.messageKind,
      keyVersion: r.keyVersion,
    }));
    expect(JSON.stringify(outboxMeta)).not.toContain("supersecret-password");
  });
});
