import { AppError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import type { ProblemDetails } from "@/application/shared/errors/problem-dto";
import { getLogger } from "@/infrastructure/observability/logger";
import { ConfigError, isDatabaseConfigError } from "@/infrastructure/config/load-config";
import { classifyDatabaseFailure } from "@/infrastructure/persistence/db-diagnostics";
import { redactString } from "@/infrastructure/observability/redaction";

/**
 * Last line of defence before a detail leaves the process: strip anything that looks
 * like a connection string or a credential. Configuration messages name settings only.
 */
export function sanitizeDetail(message: string): string {
  const redacted = redactString(message);
  if (/supersecret|secret123/i.test(redacted)) return "Server configuration is invalid. Check the deployment environment variables.";
  if (/:[^/\s@]+@/.test(redacted)) return "Server configuration is invalid. Check the deployment environment variables.";
  return redacted;
}

export function mapErrorToProblem(error: unknown, correlationId: string): ProblemDetails {
  if (error instanceof AppError) {
    return {
      type: "about:blank",
      title: error.title,
      status: error.status,
      code: error.code,
      correlationId,
      detail: sanitizeDetail(error.detail),
      errors: error.errors,
      dependency: error.dependency,
      reason: error.reason,
    };
  }

  // Missing/invalid deployment configuration: a dependency (usually the database) cannot
  // be used. Answer 503 + dependency so operators see the real cause instead of "unknown 500".
  if (error instanceof ConfigError) {
    const databaseRelated = isDatabaseConfigError(error);
    return {
      type: "about:blank",
      title: databaseRelated ? "Database dependency unavailable" : "Server configuration invalid",
      status: databaseRelated ? 503 : 500,
      code: databaseRelated ? ErrorCodes.CONFIG_MISSING : ErrorCodes.CONFIG_INVALID,
      correlationId,
      detail: sanitizeDetail(error.message),
      dependency: databaseRelated ? "database" : undefined,
      reason: databaseRelated ? "database_url_missing" : "config_invalid",
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

  // Driver/socket/Prisma failure: the database dependency is unreachable or not migrated.
  const classified = classifyDatabaseFailure(error);
  if (classified) {
    return {
      type: "about:blank",
      title: classified.dependency === "schema" ? "Database schema not ready" : "Database dependency unavailable",
      status: 503,
      code: classified.dependency === "schema" ? ErrorCodes.SCHEMA_NOT_READY : ErrorCodes.DATABASE_UNAVAILABLE,
      correlationId,
      detail: `Dependency ${classified.dependency} unavailable (${classified.reason}). Check the deployment environment and apply migrations if the schema is missing.`,
      dependency: classified.dependency,
      reason: classified.reason,
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
    reason: "unexpected_failure",
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
