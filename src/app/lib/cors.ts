import { getConfig } from "@/infrastructure/config/index";

export function isOriginAllowed(origin: string | null, allowedOrigins: string[]): boolean {
  if (!origin) return true; // same-origin or no origin (e.g., curl) allowed
  if (allowedOrigins.length === 0) {
    // Same-origin only by default
    return false;
  }
  return allowedOrigins.includes(origin);
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

export function getCorsHeaders(origin: string | null, allowedOrigins: string[]): Record<string, string> | null {
  if (!origin) return null;
  if (!isOriginAllowed(origin, allowedOrigins)) {
    return null;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Correlation-Id, Idempotency-Key, traceparent, tracestate",
    "Access-Control-Max-Age": "86400",
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
