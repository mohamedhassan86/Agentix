/**
 * Same-origin typed client boundary for foundation API.
 * No hard-coded absolute/localhost URLs - uses relative URLs.
 */

export interface ClientOptions {
  correlationId?: string;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: ClientOptions & RequestInit = {}): Promise<{ data: T; correlationId: string }> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (options.correlationId) {
    headers["X-Correlation-Id"] = options.correlationId;
  }

  const res = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });

  const correlationId = res.headers.get("X-Correlation-Id") ?? "";

  if (!res.ok) {
    const problem = await res.json().catch(() => ({}));
    const err = new Error(problem.detail ?? `Request failed ${res.status}`);
    (err as any).problem = problem;
    (err as any).correlationId = correlationId;
    (err as any).status = res.status;
    throw err;
  }

  const data = (await res.json()) as T;
  return { data, correlationId };
}

export interface HealthResponse {
  status: "alive" | "ready";
  service: "agentix-web";
  version: string;
  time: string;
}

export interface PingResponse {
  status: "ok";
  service: "agentix";
  version: string;
  time: string;
}

export const apiClient = {
  getLiveness: (opts?: ClientOptions) => request<HealthResponse>("/health/live", { ...opts, method: "GET" }),
  getReadiness: (opts?: ClientOptions) => request<HealthResponse>("/health/ready", { ...opts, method: "GET" }),
  getPing: (opts?: ClientOptions) => request<PingResponse>("/api/v1/ping", { ...opts, method: "GET" }),
};
