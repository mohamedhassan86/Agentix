import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { AppError } from "@/application/shared/errors/app-error";

describe("register-account-handler", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  it("atomically creates user, token digest, encrypted outbox, and redacted account.registered event", async () => {
    const handle = createRegisterAccountHandler(harness.deps);
    const ctx = createRequestContext({ correlationId: "0199f000-0000-7000-8000-000000000001" });
    const result = await handle(
      {
        type: REGISTER_ACCOUNT_TYPE,
        email: "  Alex@Example.TEST ",
        displayName: "Alex",
        password: "supersecret-password",
      },
      ctx,
    );

    expect(result.verificationMessageQueued).toBe(true);
    expect(result.account.email).toBe("alex@example.test");
    expect(result.account.emailVerified).toBe(false);
    expect(JSON.stringify(result)).not.toContain("supersecret-password");
    expect(JSON.stringify(result)).not.toMatch(/token=/);

    const user = await harness.store.findUserByEmailNormalized("alex@example.test");
    expect(user).not.toBeNull();
    expect(user!.passwordHash).not.toBe("supersecret-password");
    expect(user!.passwordHash).not.toContain("supersecret-password");

    const events = harness.store.events;
    expect(events.some((e) => e.eventType === "account.registered")).toBe(true);
    expect(JSON.stringify(events)).not.toContain("supersecret-password");
    expect(JSON.stringify(events)).not.toContain("token");

    const token = harness.store.lastCapturedToken();
    expect(token).toBeTruthy();
    expect(token!.length).toBeGreaterThan(40);
  });

  it("returns generic REGISTRATION_FAILED on duplicate case-insensitive trimmed email", async () => {
    const handle = createRegisterAccountHandler(harness.deps);
    const ctx = createRequestContext({ correlationId: "0199f000-0000-7000-8000-000000000002" });
    await handle(
      { type: REGISTER_ACCOUNT_TYPE, email: "dup@example.test", displayName: "A", password: "password123" },
      ctx,
    );
    await expect(
      handle(
        { type: REGISTER_ACCOUNT_TYPE, email: "  DUP@example.test  ", displayName: "B", password: "password123" },
        ctx,
      ),
    ).rejects.toMatchObject({ code: "REGISTRATION_FAILED", status: 409 } satisfies Partial<AppError>);
  });
});
