export type HealthStatus = "alive" | "ready";

export interface HealthResponse {
  status: HealthStatus;
  service: "agentix-web";
  version: string;
  time: string; // ISO datetime
}

export interface ReadinessResponse extends HealthResponse {
  status: "ready";
}

export interface LivenessResponse extends HealthResponse {
  status: "alive";
}
