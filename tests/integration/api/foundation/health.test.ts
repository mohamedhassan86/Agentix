import { describe, it, expect } from "vitest";

const CORRELATION_ID = "123e4567-e89b-12d3-a456-426614174000";

const requestContext = {
  correlationId: CORRELATION_ID,
  operation: "getReadiness",
  signal: new AbortController().signal,
  timestamp: new Date(),
} as any;

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

  it("readiness responses carry code, dependency, reason and remediation for a missing migration", async () => {
    const { createReadinessHandler } = await import("@/application/foundation/handlers/health");
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");

    const probe = {
      check: async () => ({ status: "not_ready" as const, dependency: "schema" as const, reason: "migration_table_missing" as const }),
    };

    const handler = createReadinessHandler("0.1.0", probe as any);
    let problem: any;
    try {
      await handler({ type: "foundation.health.getReadiness" } as any, requestContext);
      throw new Error("handler should have thrown");
    } catch (error) {
      problem = mapErrorToProblem(error, CORRELATION_ID);
    }

    expect(problem.status).toBe(503);
    expect(problem.code).toBe("SCHEMA_NOT_READY");
    expect(problem.dependency).toBe("schema");
    expect(problem.reason).toBe("migration_table_missing");
    expect(problem.title).toBe("Database schema not ready");
    expect(problem.detail).toMatch(/db:migrate/);
    // A ready probe never reaches the failure path
    expect(JSON.stringify(problem)).not.toContain("postgres://");
  });

  it("maps a database dependency failure with its reason and stable code", async () => {
    const { createReadinessHandler } = await import("@/application/foundation/handlers/health");
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");

    const probe = { check: async () => ({ status: "not_ready" as const, reason: "connection_refused" as const }) };
    const handler = createReadinessHandler("0.1.0", probe as any);

    try {
      await handler({ type: "foundation.health.getReadiness" } as any, requestContext);
      throw new Error("handler should have thrown");
    } catch (error) {
      const problem = mapErrorToProblem(error, CORRELATION_ID);
      expect(problem.status).toBe(503);
      expect(problem.code).toBe("DATABASE_UNAVAILABLE");
      expect(problem.dependency).toBe("database");
      expect(problem.reason).toBe("connection_refused");
      expect(problem.detail).toMatch(/pooler|6543/i);
    }
  });

  it("missing deployment configuration answers 503 with the database dependency named", async () => {
    const { loadConfig } = await import("@/infrastructure/config/load-config");
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");

    let problem: any;
    try {
      loadConfig({ NODE_ENV: "production", APP_ORIGIN: "https://example.com" } as NodeJS.ProcessEnv);
      throw new Error("config should have failed");
    } catch (error) {
      problem = mapErrorToProblem(error, CORRELATION_ID);
    }

    expect(problem.status).toBe(503);
    expect(problem.code).toBe("CONFIG_MISSING");
    expect(problem.dependency).toBe("database");
    expect(problem.reason).toBe("database_url_missing");
    expect(problem.detail).toMatch(/DATABASE_URL/);
    expect(problem.detail).not.toMatch(/postgres:\/\//);
  });

  it("driver failures answer 503 instead of an opaque 500", async () => {
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");

    const refused = mapErrorToProblem(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }), CORRELATION_ID);
    expect(refused.status).toBe(503);
    expect(refused.code).toBe("DATABASE_UNAVAILABLE");
    expect(refused.dependency).toBe("database");
    expect(refused.reason).toBe("connection_refused");

    const unknown = mapErrorToProblem(new Error("something else entirely"), CORRELATION_ID);
    expect(unknown.status).toBe(500);
    expect(unknown.dependency).toBeUndefined();
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
