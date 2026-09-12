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
