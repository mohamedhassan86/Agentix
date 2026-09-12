/**
 * WorkEnvelope - validated request to enqueue durable work
 * Phase 2 placeholder with full shape from data-model.
 */

export type WorkScope = "global" | "tenant";

export interface WorkEnvelope {
  workId: string;
  type: string;
  schemaVersion: number;
  scope: WorkScope;
  orgId: string | null;
  idempotencyKey: string;
  correlationId: string;
  traceParent?: string | null;
  traceState?: string | null;
  payload: Record<string, unknown>;
  availableAt: Date;
  maxAttempts: number;
}

export interface WorkEnvelopeOptions {
  workId: string;
  type: string;
  schemaVersion: number;
  scope: WorkScope;
  orgId?: string | null;
  idempotencyKey: string;
  correlationId: string;
  traceParent?: string | null;
  traceState?: string | null;
  payload: Record<string, unknown>;
  availableAt?: Date;
  maxAttempts?: number;
}

const SENSITIVE_PAYLOAD_KEYS = ["password", "secret", "token", "authorization", "cookie", "key", "credential"];

function containsSensitiveKeys(payload: Record<string, unknown>): string | null {
  for (const k of Object.keys(payload)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_PAYLOAD_KEYS.some((s) => lower.includes(s))) {
      return k;
    }
  }
  return null;
}

export function validateWorkEnvelope(options: WorkEnvelopeOptions): WorkEnvelope {
  if (!options.type || options.type.length < 1 || options.type.length > 120) {
    throw new Error("work type must be 1-120 characters");
  }
  if (options.schemaVersion < 1) {
    throw new Error("schemaVersion must be >=1");
  }
  if (options.scope !== "global" && options.scope !== "tenant") {
    throw new Error("scope must be global|tenant");
  }
  if (options.scope === "global" && options.orgId) {
    throw new Error("global scope must have null orgId");
  }
  if (options.scope === "tenant" && !options.orgId) {
    throw new Error("tenant scope requires orgId");
  }
  if (!options.idempotencyKey || options.idempotencyKey.length < 1 || options.idempotencyKey.length > 200) {
    throw new Error("idempotencyKey must be 1-200");
  }
  if (options.maxAttempts !== undefined && (options.maxAttempts < 1 || options.maxAttempts > 10)) {
    throw new Error("maxAttempts must be 1-10");
  }

  const sensitiveKey = containsSensitiveKeys(options.payload);
  if (sensitiveKey) {
    throw new Error(`payload contains sensitive key: ${sensitiveKey}`);
  }

  const payloadSize = JSON.stringify(options.payload).length;
  if (payloadSize > 64 * 1024) {
    throw new Error("payload exceeds 64 KiB");
  }

  if (options.traceParent && options.traceParent.length > 55) {
    throw new Error("traceParent exceeds 55 chars");
  }
  if (options.traceState && options.traceState.length > 512) {
    throw new Error("traceState exceeds 512 chars");
  }

  return {
    workId: options.workId,
    type: options.type,
    schemaVersion: options.schemaVersion,
    scope: options.scope,
    orgId: options.orgId ?? null,
    idempotencyKey: options.idempotencyKey,
    correlationId: options.correlationId,
    traceParent: options.traceParent ?? null,
    traceState: options.traceState ?? null,
    payload: options.payload,
    availableAt: options.availableAt ?? new Date(),
    maxAttempts: options.maxAttempts ?? 3,
  };
}

export function globalWork(options: Omit<WorkEnvelopeOptions, "scope" | "orgId">): WorkEnvelope {
  return validateWorkEnvelope({ ...options, scope: "global", orgId: null });
}

export function tenantWork(orgId: string, options: Omit<WorkEnvelopeOptions, "scope" | "orgId">): WorkEnvelope {
  if (!orgId) throw new Error("orgId required for tenant work");
  return validateWorkEnvelope({ ...options, scope: "tenant", orgId });
}
