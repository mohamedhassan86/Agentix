import type { RequestContext } from "@/application/shared/context/request-context";
import type { IReadinessProbe } from "@/application/shared/ports/readiness-probe";
import type { HealthResponse } from "../dto/health";
import type { GetLivenessQuery, GetReadinessQuery } from "../queries/health";
import { UnavailableError } from "@/application/shared/errors/app-error";

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
      const dep = (result.dependency as "database" | "schema") ?? "database";
      throw new UnavailableError(`Dependency ${dep} not ready`, dep);
    }
    return {
      status: "ready",
      service: "agentix-web",
      version,
      time: new Date().toISOString(),
    };
  };
}
