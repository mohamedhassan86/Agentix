import type { RequestContext } from "@/application/shared/context/request-context";
import type { PingResponse } from "../dto/ping";
import type { GetPingQuery } from "../queries/ping";

export function createPingHandler(version: string) {
  return async (_query: GetPingQuery, _ctx: RequestContext): Promise<PingResponse> => {
    return {
      status: "ok",
      service: "agentix",
      version,
      time: new Date().toISOString(),
    };
  };
}
