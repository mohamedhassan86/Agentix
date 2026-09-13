/**
 * Opaque session cookie contract.
 * Cookie name matches OpenAPI securitySchemes.sessionCookie.
 */

export const SESSION_COOKIE_NAME = "__Secure-agentix.session-token";

export interface SessionCookieOptions {
  secure: boolean;
  maxAgeSeconds: number;
  path?: string;
}

export function buildSessionCookieHeader(rawToken: string, options: SessionCookieOptions): string {
  return [
    `${SESSION_COOKIE_NAME}=${rawToken}`,
    `Path=${options.path ?? "/"}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${options.maxAgeSeconds}`,
  ].join("; ");
}

export function buildClearSessionCookieHeader(_secure = true): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export function readSessionTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = trimmed.slice(eq + 1).trim();
      return value.length > 0 ? value : null;
    }
  }
  return null;
}
