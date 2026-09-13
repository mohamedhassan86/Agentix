import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as verify } from "@/app/api/v1/auth/verify-email/route";
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { POST as resend } from "@/app/api/v1/auth/verification-messages/route";
import { GET as session } from "@/app/api/v1/session/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness, type IdentityHarness } from "../../../helpers/identity-harness";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/auth/session-cookie";

function cookieFrom(res: Response): string {
  const header = res.headers.get("Set-Cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : "";
}

describe("POST /api/v1/auth/verify-email", () => {
  let harness: IdentityHarness;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("verifies once, reuse is already_verified without sign-in side effect, resend rotates token", async () => {
    await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ver@example.test", displayName: "Ver", password: "password123" }),
      }),
    );
    const token = harness.store.lastCapturedToken();
    const first = await verify(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(first.status).toBe(200);
    expect((await first.json()).status).toBe("verified");

    const second = await verify(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }),
    );
    expect(second.status).toBe(200);
    expect((await second.json()).status).toBe("already_verified");
    expect(second.headers.get("Set-Cookie")).toBeNull();

    const signed = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "ver@example.test", password: "password123" }),
      }),
    );
    const cookie = cookieFrom(signed);
    const ctx = await session(new Request("http://localhost/api/v1/session", { headers: { Cookie: cookie } }));
    expect((await ctx.json()).activeOrganizationId).toBeNull();
  });

  it("returns TokenProblem for garbage tokens and invalidates prior token on resend", async () => {
    await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tok@example.test", displayName: "Tok", password: "password123" }),
      }),
    );
    const oldToken = harness.store.lastCapturedToken();
    const signed = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "tok@example.test", password: "password123" }),
      }),
    );
    const queued = await resend(
      new Request("http://localhost/api/v1/auth/verification-messages", {
        method: "POST",
        headers: { Cookie: cookieFrom(signed) },
      }),
    );
    expect(queued.status).toBe(202);

    const expired = await verify(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: oldToken }),
      }),
    );
    expect(expired.status).toBe(400);
    expect((await expired.json()).code).toBe("TOKEN_INVALID");

    const garbage = await verify(
      new Request("http://localhost/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "not-a-valid-token-value-at-all-xxxxxxxx-extra" }),
      }),
    );
    expect(garbage.status).toBe(400);
    expect((await garbage.json()).code).toBe("TOKEN_INVALID");
  });
});
