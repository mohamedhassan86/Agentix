import { normalizeCorrelationId } from "./correlation";

export interface RequestContextOptions {
  correlationId?: string;
  signal?: AbortSignal;
  orgId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  operation?: string;
  workId?: string;
}

export interface RequestContext {
  correlationId: string;
  signal: AbortSignal;
  orgId: string | null;
  projectId: string | null;
  runId: string | null;
  operation?: string;
  workId?: string;
  readonly isAborted: boolean;
}

export function createRequestContext(options: RequestContextOptions = {}): RequestContext {
  const correlationId = normalizeCorrelationId(options.correlationId);
  const signal = options.signal ?? new AbortController().signal;

  return {
    correlationId,
    signal,
    orgId: options.orgId ?? null,
    projectId: options.projectId ?? null,
    runId: options.runId ?? null,
    operation: options.operation,
    workId: options.workId,
    get isAborted() {
      return signal.aborted;
    },
  };
}
