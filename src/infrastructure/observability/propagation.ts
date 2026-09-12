/**
 * W3C trace context validation
 */

const TRACEPARENT_REGEX = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const TRACEPARENT_MAX_LENGTH = 55;
const TRACESTATE_MAX_LENGTH = 512;

export function validateTraceParent(traceParent: string | null | undefined): boolean {
  if (!traceParent) return false;
  if (typeof traceParent !== "string") return false;
  if (traceParent.length > TRACEPARENT_MAX_LENGTH) return false;
  return TRACEPARENT_REGEX.test(traceParent);
}

export function validateTraceState(traceState: string | null | undefined): boolean {
  if (!traceState) return true; // optional, so null is valid (means no tracestate)
  if (typeof traceState !== "string") return false;
  if (traceState.length > TRACESTATE_MAX_LENGTH) return false;
  // Basic validation: tracestate is list of key=value pairs
  // For simplicity, check it doesn't contain invalid chars and is not too long
  // Real validation is more complex, but we do minimal
  if (traceState.trim().length === 0) return false;
  return true;
}

export function extractTraceContext(headers: Record<string, string | undefined>): {
  traceParent?: string;
  traceState?: string;
} {
  const traceParent = headers["traceparent"] ?? headers["Traceparent"];
  const traceState = headers["tracestate"] ?? headers["Tracestate"];

  const result: { traceParent?: string; traceState?: string } = {};
  if (validateTraceParent(traceParent)) {
    result.traceParent = traceParent;
  }
  if (traceState && validateTraceState(traceState)) {
    result.traceState = traceState;
  }
  return result;
}
