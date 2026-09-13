import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { createSignInHandler } from "@/application/identity/handlers/sign-in-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { FixedClock } from "@/application/shared/ports/clock";

describe("sign-in-handler", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  async function register(email = "user@example.test") {
    const handle = createRegisterAccountHandler(harness.deps);
    await handle(
      { type: REGISTER_ACCOUNT_TYPE, email, displayName: "User", password: "password123" },
      createRequestContext(),
    );
  }

  it("uses dummy hash for unknown email and returns generic AUTHENTICATION_FAILED", async () => {
    const handle = createSignInHandler(harness.deps);
    await expect(
      handle(
        { type: SIGN_IN_TYPE, email: "unknown@example.test", password: "password123" },
        createRequestContext(),
      ),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED", status: 401 });
  });

  it("locks after 5 consecutive failures for 15 minutes with the same generic error", async () => {
    await register();
    const handle = createSignInHandler(harness.deps);
    for (let i = 0; i < 5; i++) {
      await expect(
        handle({ type: SIGN_IN_TYPE, email: "user@example.test", password: "wrong-pass" }, createRequestContext()),
      ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED", status: 401 });
    }
    await expect(
      handle({ type: SIGN_IN_TYPE, email: "user@example.test", password: "password123" }, createRequestContext()),
    ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED", status: 401 });
  });

  it("success after lock expiry clears throttle and starts session with null active org", async () => {
    const start = new Date("2026-09-13T00:00:00.000Z");
    harness = createIdentityHarness({ clock: new FixedClock(start) });
    await register();
    const handle = createSignInHandler(harness.deps);
    for (let i = 0; i < 5; i++) {
      await expect(
        handle({ type: SIGN_IN_TYPE, email: "user@example.test", password: "wrong-pass" }, createRequestContext()),
      ).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
    }

    const later = new Date(start.getTime() + 16 * 60 * 1000);
    harness = {
      ...harness,
      deps: { ...harness.deps, clock: new FixedClock(later), store: harness.store },
    };
    const unlocked = createSignInHandler(harness.deps);
    const result = await unlocked(
      { type: SIGN_IN_TYPE, email: "user@example.test", password: "password123" },
      createRequestContext(),
    );
    expect(result.sessionContext.activeOrganizationId).toBeNull();
    expect(result.sessionContext.activeRole).toBeNull();
    expect(result.rawSessionToken).toMatch(/^[0-9a-f-]+\.[A-Za-z0-9_-]+$/i);
  });
});
