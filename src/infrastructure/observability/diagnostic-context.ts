export interface DiagnosticContext {
  correlationId: string;
  operation?: string;
  workId?: string;
  orgId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  phase?: string;
  agent?: string;
}

export function createDiagnosticContext(params: {
  correlationId: string;
  operation?: string;
  workId?: string;
  orgId?: string | null;
  projectId?: string | null;
  runId?: string | null;
  phase?: string;
  agent?: string;
}): DiagnosticContext {
  return {
    correlationId: params.correlationId,
    operation: params.operation,
    workId: params.workId,
    orgId: params.orgId ?? null,
    projectId: params.projectId ?? null,
    runId: params.runId ?? null,
    phase: params.phase,
    agent: params.agent,
  };
}
