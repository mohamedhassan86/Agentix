import { describe, it, expect } from "vitest";

describe("app and worker startup", () => {
  it("config fails fast with safe remediation and no secret leakage", async () => {
    const originalEnv = { ...process.env };
    try {
      delete process.env.DATABASE_URL;
      const { loadConfig, ConfigError } = await import("@/infrastructure/config/load-config");
      expect(() => loadConfig()).toThrow(ConfigError);
      try {
        loadConfig();
      } catch (e: any) {
        expect(e.message).toMatch(/DATABASE_URL/);
        expect(e.message).not.toContain("postgres://");
        expect(e.message.toLowerCase()).toMatch(/remediation|set|configure/);
      }
    } finally {
      process.env = originalEnv;
    }
  });

  it("worker composition fails fast when DATABASE_URL missing", async () => {
    const originalEnv = { ...process.env };
    try {
      delete process.env.DATABASE_URL;
      // Clear composition cache
      const { clearWorkerComposition } = await import("@/worker/composition-root");
      clearWorkerComposition();
      const { createWorkerComposition } = await import("@/worker/composition-root");
      expect(() => createWorkerComposition()).toThrow();
    } finally {
      process.env = originalEnv;
      const { clearWorkerComposition } = await import("@/worker/composition-root");
      clearWorkerComposition();
    }
  });

  it("app composition creates dispatcher with health and ping handlers", async () => {
    const { clearAppComposition, createAppComposition } = await import("@/app/lib/composition-root");
    clearAppComposition();
    // Ensure DATABASE_URL present for config
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as any).NODE_ENV = "development";
    const comp = createAppComposition();
    expect(comp.dispatcher).toBeDefined();
    // Handlers registered
    // We can't directly check private map, but we can try dispatch
    const { GET_LIVENESS_TYPE } = await import("@/application/foundation/queries/health");
    const ctx = {
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      operation: "test",
      signal: new AbortController().signal,
      timestamp: new Date(),
    } as any;
    const result = await comp.dispatcher.dispatch({ type: GET_LIVENESS_TYPE } as any, ctx);
    expect((result as any).status).toBe("alive");
    clearAppComposition();
  });
});

describe("resilient web composition", () => {
  it("keeps process-only endpoints alive when the database is not configured", async () => {
    const originalEnv = { ...process.env };
    try {
      delete process.env.DATABASE_URL;
      delete process.env.POSTGRES_PRISMA_URL;
      delete process.env.POSTGRES_URL;
      delete process.env.SUPABASE_DB_URL;
      (process.env as Record<string, string>).NODE_ENV = "test";

      const { clearAppComposition, createAppComposition } = await import("@/app/lib/composition-root");
      const { GET_LIVENESS_TYPE, GET_READINESS_TYPE } = await import("@/application/foundation/queries/health");
      const { mapErrorToProblem } = await import("@/app/lib/problem-response");
      clearAppComposition();

      const composition = createAppComposition();
      const ctx = {
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        operation: "test",
        signal: new AbortController().signal,
        timestamp: new Date(),
      } as never;

      // Liveness is process-only: it must not depend on database configuration.
      const live = (await composition.dispatcher.dispatch({ type: GET_LIVENESS_TYPE } as never, ctx)) as { status: string };
      expect(live.status).toBe("alive");

      // Readiness reports the missing configuration as a 503 with the database dependency.
      let problem: ReturnType<typeof mapErrorToProblem> | null = null;
      try {
        await composition.dispatcher.dispatch({ type: GET_READINESS_TYPE } as never, ctx);
      } catch (error) {
        problem = mapErrorToProblem(error, "123e4567-e89b-12d3-a456-426614174000");
      }
      expect(problem?.status).toBe(503);
      expect(problem?.dependency).toBe("database");
      expect(problem?.reason).toBe("database_url_missing");
      clearAppComposition();
    } finally {
      process.env = originalEnv;
    }
  });
});
