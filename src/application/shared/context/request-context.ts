import { normalizeCorrelationId } from "./correlation";

export interface IdentityActor {
  userId: string;
  sessionId: string;
  sessionTokenDigest: Uint8Array;
  activeOrgId: string | null;
  activeRole: "viewer" | "member" | "admin" | "owner" | null;
  isPlatformAdmin: boolean;
  emailNormalized: string;
  displayName: string;
}

export interface RequestContextOptions {
  correlationId?: string;
  signal?: AbortSignal;
  orgId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  operation?: string;
  workId?: string;
  actor?: IdentityActor | null;
}

export interface RequestContext {
  correlationId: string;
  signal: AbortSignal;
  orgId: string | null;
  projectId: string | null;
  runId: string | null;
  operation?: string;
  workId?: string;
  actor: IdentityActor | null;
  readonly isAborted: boolean;
}

export function createRequestContext(options: RequestContextOptions = {}): RequestContext {
  const correlationId = normalizeCorrelationId(options.correlationId);
  const signal = options.signal ?? new AbortController().signal;

  return {
    correlationId,
    signal,
    orgId: options.orgId ?? options.actor?.activeOrgId ?? null,
    projectId: options.projectId ?? null,
    runId: options.runId ?? null,
    operation: options.operation,
    workId: options.workId,
    actor: options.actor ?? null,
    get isAborted() {
      return signal.aborted;
    },
  };
}
