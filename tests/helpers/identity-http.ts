import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { SESSION_COOKIE_NAME } from "@/infrastructure/identity/auth/session-cookie";

export function cookieFrom(res: Response): string {
  const header = res.headers.get("Set-Cookie") ?? "";
  const match = header.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : "";
}

export async function registerAndSignIn(email: string, password = "password123"): Promise<{ cookie: string; email: string }> {
  await register(
    new Request("http://localhost/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, displayName: email.split("@")[0], password }),
    }),
  );
  const signed = await signIn(
    new Request("http://localhost/api/v1/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
  return { cookie: cookieFrom(signed), email };
}
