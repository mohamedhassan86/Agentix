import { AppError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import type { ProblemDetails } from "@/application/shared/errors/problem-dto";
import { getLogger } from "@/infrastructure/observability/logger";

export function mapErrorToProblem(error: unknown, correlationId: string): ProblemDetails {
  if (error instanceof AppError) {
    return {
      type: "about:blank",
      title: error.title,
      status: error.status,
      code: error.code,
      correlationId,
      detail: error.detail,
      errors: error.errors,
      dependency: error.dependency,
    };
  }

  // Check for CORS error
  if (error instanceof Error && error.message.includes("CORS")) {
    return {
      type: "about:blank",
      title: "Origin not allowed",
      status: 403,
      code: ErrorCodes.CORS_ORIGIN_NOT_ALLOWED,
      correlationId,
      detail: "The request origin is not in the explicit allow-list",
    };
  }

  // Unexpected error - log safely and return generic
  const logger = getLogger();
  try {
    logger.error({ err: { name: (error as Error).name, message: "unexpected" }, code: ErrorCodes.UNEXPECTED_FAILURE, correlationId });
  } catch {
    // ignore logger failure
    void 0;
  }

  return {
    type: "about:blank",
    title: "Internal server error",
    status: 500,
    code: ErrorCodes.UNEXPECTED_FAILURE,
    correlationId,
    detail: "An unexpected error occurred",
  };
}

export function createProblemResponse(problem: ProblemDetails): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/problem+json",
    "X-Correlation-Id": problem.correlationId,
    "Cache-Control": "no-store",
  };

  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers,
  });
}
