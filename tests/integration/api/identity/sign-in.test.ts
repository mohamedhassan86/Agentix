import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/auth/session-cookie";

describe("POST /api/v1/auth/sign-in", () => {
  beforeEach(() => {
    setAppCompositionForTests(createIdentityHarness().composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  async function seed() {
    await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "login@example.test", displayName: "Login", password: "password123" }),
      }),
    );
  }

  it("returns 200 SessionContext with null active org and opaque secure cookie", async () => {
    await seed();
    const res = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Correlation-Id": "0199f000-0000-7000-8000-000000000011" },
        body: JSON.stringify({ email: "login@example.test", password: "password123" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Correlation-Id")).toBe("0199f000-0000-7000-8000-000000000011");
    const cookie = res.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain(SESSION_COOKIE_NAME);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const body = await res.json();
    expect(body.activeOrganizationId).toBeNull();
    expect(body.activeRole).toBeNull();
    expect(body.platformAdministrator).toBe(false);
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("returns generic 401 for unknown, bad, and locked identifiers", async () => {
    await seed();
    const unknown = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "missing@example.test", password: "password123" }),
      }),
    );
    expect(unknown.status).toBe(401);
    expect((await unknown.json()).code).toBe("AUTHENTICATION_FAILED");

    const bad = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "login@example.test", password: "nope-nope" }),
      }),
    );
    expect(bad.status).toBe(401);
    expect((await bad.json()).code).toBe("AUTHENTICATION_FAILED");

    for (let i = 0; i < 5; i++) {
      await signIn(
        new Request("http://localhost/api/v1/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "login@example.test", password: "nope-nope" }),
        }),
      );
    }
    const locked = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "login@example.test", password: "password123" }),
      }),
    );
    expect(locked.status).toBe(401);
    expect((await locked.json()).code).toBe("AUTHENTICATION_FAILED");
  });
});
