import type { ErrorCode } from "./error-codes";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode | string;
  correlationId: string;
  detail?: string;
  errors?: Record<string, string[]>;
  instance?: string;
  dependency?: "database" | "schema";
  /**
   * Machine-readable, non-sensitive failure reason (closed set, lowercase snake_case).
   * Lets clients show remediation without parsing prose.
   */
  reason?: string;
}

export function createProblemDetails(params: {
  type?: string;
  title: string;
  status: number;
  code: string;
  correlationId: string;
  detail?: string;
  errors?: Record<string, string[]>;
  instance?: string;
  dependency?: "database" | "schema";
  reason?: string;
}): ProblemDetails {
  return {
    type: params.type ?? "about:blank",
    title: params.title,
    status: params.status,
    code: params.code,
    correlationId: params.correlationId,
    detail: params.detail,
    errors: params.errors,
    instance: params.instance,
    dependency: params.dependency,
    reason: params.reason,
  };
}
