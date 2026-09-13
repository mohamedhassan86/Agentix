import type { RequestContext } from "@/application/shared/context/request-context";
import type { IReadinessProbe } from "@/application/shared/ports/readiness-probe";
import { dependencyForReason, remediationForReason } from "@/application/shared/ports/readiness-probe";
import type { HealthResponse } from "../dto/health";
import type { GetLivenessQuery, GetReadinessQuery } from "../queries/health";
import { UnavailableError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";

export function createLivenessHandler(version: string) {
  return async (_query: GetLivenessQuery, _ctx: RequestContext): Promise<HealthResponse> => {
    return {
      status: "alive",
      service: "agentix-web",
      version,
      time: new Date().toISOString(),
    };
  };
}

export function createReadinessHandler(version: string, probe: IReadinessProbe) {
  return async (_query: GetReadinessQuery, _ctx: RequestContext): Promise<HealthResponse> => {
    const result = await probe.check();
    if (result.status !== "ready") {
      // The probe reports a closed-set reason; the dependency and the stable error
      // code are derived from it so callers never have to guess ("unknown").
      const reason = result.reason ?? "unknown_database_error";
      const dependency = result.dependency ?? dependencyForReason(reason);
      const code = dependency === "schema" ? ErrorCodes.SCHEMA_NOT_READY : ErrorCodes.DATABASE_UNAVAILABLE;

      throw new UnavailableError(`Dependency ${dependency} not ready`, {
        dependency,
        reason,
        code,
        status: 503,
        title: dependency === "schema" ? "Database schema not ready" : "Database dependency unavailable",
        // Closed-set remediation text: no driver message, no connection string.
        detail: remediationForReason(reason),
      });
    }
    return {
      status: "ready",
      service: "agentix-web",
      version,
      time: new Date().toISOString(),
    };
  };
}
