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
  };
}
