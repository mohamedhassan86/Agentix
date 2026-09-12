export type ReadinessStatus = "ready" | "not_ready";
export type DependencyCategory = "database" | "schema";

export interface ReadinessProbeResult {
  status: ReadinessStatus;
  dependency?: DependencyCategory;
  message?: string;
}

export interface IReadinessProbe {
  check(): Promise<ReadinessProbeResult>;
}
