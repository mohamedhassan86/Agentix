import { getConfig } from "@/infrastructure/config/index";

export interface OriginCheckOptions {
  /** Exact origin of this app (APP_ORIGIN). Requests from it are same-origin and always allowed. */
  appOrigin?: string | null;
  /** Effective request host (Host / X-Forwarded-Host header). Covers preview and proxy hosts. */
  requestHost?: string | null;
}

function isSameOriginAsHost(origin: string, requestHost: string | null | undefined): boolean {
  if (!requestHost) return false;
  try {
    return new URL(origin).host === requestHost;
  } catch {
    return false;
  }
}

export function isOriginAllowed(
  origin: string | null,
  allowedOrigins: string[],
  options: OriginCheckOptions = {},
): boolean {
  if (!origin) return true; // same-origin GET or no origin (e.g., curl) allowed
  if (allowedOrigins.includes(origin)) return true;
  // Browsers attach Origin even on same-origin POST/PUT/DELETE: always allow the app's own origin...
  if (options.appOrigin && origin === options.appOrigin) return true;
  // ...or whatever host actually served this request (preview/proxy deployments).
  if (isSameOriginAsHost(origin, options.requestHost)) return true;
  return false;
}

export function parseAndValidateOrigin(originHeader: string | null): string | null {
  if (!originHeader) return null;
  try {
    const url = new URL(originHeader);
    // Exact origin check: no path beyond /
    return url.origin;
  } catch {
    return null;
  }
}

export function getCorsHeaders(
  origin: string | null,
  allowedOrigins: string[],
  options: OriginCheckOptions = {},
): Record<string, string> | null {
  if (!origin) return null;
  if (!isOriginAllowed(origin, allowedOrigins, options)) {
    return null;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Correlation-Id, Idempotency-Key, traceparent, tracestate",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function getAllowedOrigins(): string[] {
  try {
    const cfg = getConfig();
    return cfg.app.corsOrigins;
  } catch {
    return [];
  }
}

export function getAppOrigin(): string | null {
  try {
    const cfg = getConfig();
    return cfg.app.origin ?? null;
  } catch {
    return null;
  }
}

/** Resolve the effective request host, preferring the first X-Forwarded-Host behind proxies. */
export function getRequestHost(headers: Headers): string | null {
  const forwarded = headers.get("X-Forwarded-Host");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("Host");
}
