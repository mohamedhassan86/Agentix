import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/auth/session-cookie";

describe("POST /api/v1/auth/register", () => {
  let harness: ReturnType<typeof createIdentityHarness>;

  beforeEach(() => {
    harness = createIdentityHarness();
    setAppCompositionForTests(harness.composition);
  });

  afterEach(() => {
    clearAppComposition();
  });

  it("returns 201 RegisterResult unverified, queues verification, and never returns a token", async () => {
    const res = await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Correlation-Id": "0199f000-0000-7000-8000-000000000010" },
        body: JSON.stringify({ email: "new@example.test", displayName: "New", password: "password123" }),
      }),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("X-Correlation-Id")).toMatch(/^[0-9a-f-]{36}$/i);
    const body = await res.json();
    expect(body.verificationMessageQueued).toBe(true);
    expect(body.account.emailVerified).toBe(false);
    expect(body.account.email).toBe("new@example.test");
    expect(JSON.stringify(body)).not.toContain("password123");
    expect(JSON.stringify(body)).not.toContain("token");
    expect(harness.store.lastCapturedToken()).toBeTruthy();
    expect(harness.deps.hasher).toBeTruthy();
    const user = await harness.store.findUserByEmailNormalized("new@example.test");
    expect(user!.passwordHash).not.toBe("password123");
  });

  it("returns generic 409 REGISTRATION_FAILED on duplicate case-insensitive trimmed email without leaking existence", async () => {
    await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "dup@example.test", displayName: "A", password: "password123" }),
      }),
    );
    const res = await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "  DUP@Example.TEST ", displayName: "B", password: "password123" }),
      }),
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("REGISTRATION_FAILED");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("already");
    expect(JSON.stringify(body)).not.toContain(SESSION_COOKIE_NAME);
  });
});
