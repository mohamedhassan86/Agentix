import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { POST as signOut } from "@/app/api/v1/auth/sign-out/route";
import { GET as session } from "@/app/api/v1/session/route";
import { clearAppComposition, setAppCompositionForTests } from "@/app/lib/composition-root";
import { createIdentityHarness } from "../../../helpers/identity-harness";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/auth/session-cookie";

function cookieFrom(res: Response): string {
  const header = res.headers.get("Set-Cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : "";
}

describe("POST /api/v1/auth/sign-out", () => {
  beforeEach(() => {
    setAppCompositionForTests(createIdentityHarness().composition);
  });
  afterEach(() => {
    clearAppComposition();
  });

  it("returns 204, revokes the session, and subsequent requests are 401", async () => {
    await register(
      new Request("http://localhost/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "out@example.test", displayName: "Out", password: "password123" }),
      }),
    );
    const signed = await signIn(
      new Request("http://localhost/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "out@example.test", password: "password123" }),
      }),
    );
    const cookie = cookieFrom(signed);
    const out = await signOut(
      new Request("http://localhost/api/v1/auth/sign-out", {
        method: "POST",
        headers: { Cookie: cookie },
      }),
    );
    expect(out.status).toBe(204);
    const again = await session(
      new Request("http://localhost/api/v1/session", {
        method: "GET",
        headers: { Cookie: cookie },
      }),
    );
    expect(again.status).toBe(401);
  });
});
