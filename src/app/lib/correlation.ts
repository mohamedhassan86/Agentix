import { normalizeCorrelationId } from "@/application/shared/context/correlation";

export const CORRELATION_HEADER = "X-Correlation-Id";

export function getCorrelationIdFromHeaders(headers: Headers | Record<string, string | undefined>): string {
  let incoming: string | undefined;
  if (headers instanceof Headers) {
    incoming = headers.get(CORRELATION_HEADER) ?? headers.get(CORRELATION_HEADER.toLowerCase()) ?? undefined;
  } else {
    incoming = headers[CORRELATION_HEADER] ?? headers[CORRELATION_HEADER.toLowerCase()];
  }
  return normalizeCorrelationId(incoming);
}

export function createCorrelationHeaders(correlationId: string): Record<string, string> {
  return {
    [CORRELATION_HEADER]: correlationId,
  };
}
