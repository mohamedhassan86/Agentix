import { describe, it, expect, beforeEach } from "vitest";
import { createRequestContext } from "@/application/shared/context/request-context";
import { createRegisterAccountHandler } from "@/application/identity/handlers/register-account-handler";
import { createVerifyEmailHandler } from "@/application/identity/handlers/verify-email-handler";
import { createResendVerificationHandler } from "@/application/identity/handlers/resend-verification-handler";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { VERIFY_EMAIL_TYPE } from "@/application/identity/commands/verify-email";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { createSignInHandler } from "@/application/identity/handlers/sign-in-handler";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";

describe("verification-handler", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
  });

  it("consumes a valid token and is idempotent for already_verified", async () => {
    const register = createRegisterAccountHandler(harness.deps);
    await register(
      { type: REGISTER_ACCOUNT_TYPE, email: "v@example.test", displayName: "V", password: "password123" },
      createRequestContext(),
    );
    const token = harness.store.lastCapturedToken();
    expect(token).toBeTruthy();
    const verify = createVerifyEmailHandler(harness.deps);
    const first = await verify({ type: VERIFY_EMAIL_TYPE, token: token! }, createRequestContext());
    expect(first.status).toBe("verified");
    const second = await verify({ type: VERIFY_EMAIL_TYPE, token: token! }, createRequestContext());
    expect(second.status).toBe("already_verified");
  });

  it("fails expired or revoked tokens and resend revokes outstanding tokens", async () => {
    const register = createRegisterAccountHandler(harness.deps);
    await register(
      { type: REGISTER_ACCOUNT_TYPE, email: "r@example.test", displayName: "R", password: "password123" },
      createRequestContext(),
    );
    const oldToken = harness.store.lastCapturedToken();
    const signIn = createSignInHandler(harness.deps);
    const session = await signIn(
      { type: SIGN_IN_TYPE, email: "r@example.test", password: "password123" },
      createRequestContext(),
    );
    const actorStore = await harness.composition.sessionService.resolveActor(session.rawSessionToken);
    const resend = createResendVerificationHandler(harness.deps);
    await resend({ type: "identity.account.resendVerification" }, createRequestContext({ actor: actorStore }));
    const verify = createVerifyEmailHandler(harness.deps);
    await expect(verify({ type: VERIFY_EMAIL_TYPE, token: oldToken! }, createRequestContext())).rejects.toMatchObject({
      code: "TOKEN_INVALID",
      status: 400,
    });
    const newToken = harness.store.lastCapturedToken();
    expect(newToken).not.toBe(oldToken);
    const ok = await verify({ type: VERIFY_EMAIL_TYPE, token: newToken! }, createRequestContext());
    expect(ok.status).toBe("verified");
  });
});
