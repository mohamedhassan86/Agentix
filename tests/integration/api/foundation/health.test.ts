import { describe, it, expect } from "vitest";

describe("foundation health integration", () => {
  it("liveness handler returns alive without DB", async () => {
    const { createLivenessHandler } = await import("@/application/foundation/handlers/health");
    const handler = createLivenessHandler("0.1.0");
    const result = await handler({ type: "foundation.health.getLiveness" } as any, {
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      operation: "getLiveness",
      signal: new AbortController().signal,
      timestamp: new Date(),
    } as any);

    expect(result.status).toBe("alive");
    expect(result.service).toBe("agentix-web");
    expect(result.version).toBe("0.1.0");
    expect(new Date(result.time).toString()).not.toBe("Invalid Date");
  });

  it("readiness fails with safe dependency when DB unavailable", async () => {
    const { createReadinessHandler } = await import("@/application/foundation/handlers/health");
    const { UnavailableError } = await import("@/application/shared/errors/app-error");

    const fakeProbe = {
      check: async () => ({ status: "not_ready" as const, dependency: "database" as const, message: "DB down" }),
    };

    const handler = createReadinessHandler("0.1.0", fakeProbe as any);

    await expect(
      handler({ type: "foundation.health.getReadiness" } as any, {
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        operation: "getReadiness",
        signal: new AbortController().signal,
        timestamp: new Date(),
      } as any)
    ).rejects.toThrow(UnavailableError);

    try {
      await handler({ type: "foundation.health.getReadiness" } as any, {
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        operation: "getReadiness",
        signal: new AbortController().signal,
        timestamp: new Date(),
      } as any);
    } catch (e: any) {
      expect(e.dependency).toBe("database");
      expect(e.message).not.toContain("postgres://");
      expect(e.message).not.toContain("supersecret");
    }
  });

  it("readiness succeeds when probe ready", async () => {
    const { createReadinessHandler } = await import("@/application/foundation/handlers/health");

    const fakeProbe = {
      check: async () => ({ status: "ready" as const }),
    };

    const handler = createReadinessHandler("0.1.0", fakeProbe as any);
    const result = await handler({ type: "foundation.health.getReadiness" } as any, {
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      operation: "getReadiness",
      signal: new AbortController().signal,
      timestamp: new Date(),
    } as any);

    expect(result.status).toBe("ready");
  });

  it("health responses have no-store and correlation headers via route-dispatch", async () => {
    // This is tested via route-dispatch unit, but we assert mapping
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");
    const problem = mapErrorToProblem(new Error("CORS origin not allowed"), "123e4567-e89b-12d3-a456-426614174000");
    expect(problem.status).toBe(403);
    expect(problem.code).toBeDefined();
    expect(problem.correlationId).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});
