/**
 * WorkContext - explicit work execution context for worker handlers.
 * Contains idempotency identity, correlation, cancellation, and scope.
 */

export interface WorkContext {
  workId: string;
  type: string;
  schemaVersion: number;
  scope: "global" | "tenant";
  orgId: string | null;
  correlationId: string;
  traceParent?: string | null;
  traceState?: string | null;
  attemptNumber: number;
  workerId: string;
  signal: AbortSignal;
  requestedAt: Date;
}

export function createWorkContext(params: {
  workId: string;
  type: string;
  schemaVersion: number;
  scope: "global" | "tenant";
  orgId: string | null;
  correlationId: string;
  traceParent?: string | null;
  traceState?: string | null;
  attemptNumber: number;
  workerId: string;
  signal: AbortSignal;
  requestedAt?: Date;
}): WorkContext {
  if (params.scope === "global" && params.orgId) {
    throw new Error("global scope must have null orgId");
  }
  if (params.scope === "tenant" && !params.orgId) {
    throw new Error("tenant scope requires orgId");
  }
  return {
    workId: params.workId,
    type: params.type,
    schemaVersion: params.schemaVersion,
    scope: params.scope,
    orgId: params.orgId,
    correlationId: params.correlationId,
    traceParent: params.traceParent ?? null,
    traceState: params.traceState ?? null,
    attemptNumber: params.attemptNumber,
    workerId: params.workerId,
    signal: params.signal,
    requestedAt: params.requestedAt ?? new Date(),
  };
}
