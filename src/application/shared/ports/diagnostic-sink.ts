export interface DiagnosticRecord {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  correlationId: string;
  operation?: string;
  workId?: string;
  status?: string;
  code?: string;
  message?: string;
  orgId?: string | null;
  projectId?: string | null;
  runId?: string | null;
}

export interface IDiagnosticSink {
  write(record: DiagnosticRecord): void;
}
