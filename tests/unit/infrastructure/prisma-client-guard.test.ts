import { describe, expect, it } from "vitest";
import {
  PrismaClientUnavailableError,
  evaluateStubPolicy,
  isPrismaClientStub,
  withStubGuard,
} from "@/infrastructure/persistence/prisma";
import { mapErrorToProblem } from "@/app/lib/problem-response";
import { ConfigError } from "@/infrastructure/config/load-config";
import { resolveDatabaseUrls } from "@/infrastructure/config/database-url";

const CORR = "123e4567-e89b-12d3-a456-426614174000";

describe("prisma client stub policy", () => {
  it("rejects the stub in production unless explicitly allowed", () => {
    expect(evaluateStubPolicy({ NODE_ENV: "production" })).toBe("reject");
    expect(evaluateStubPolicy({ NODE_ENV: "production", ALLOW_PRISMA_STUB: "true" })).toBe("allow");
    expect(evaluateStubPolicy({ NODE_ENV: "test" })).toBe("allow");
    expect(evaluateStubPolicy({})).toBe("allow");
  });

  it("reports the stub state as a boolean", () => {
    expect(typeof isPrismaClientStub()).toBe("boolean");
  });

  it("blocks data access on a stub client without breaking health checks", () => {
    const stubLike = {
      outboxMessage: { create: async () => ({}) },
      $transaction: async (fn: any) => fn({}),
      $connect: async () => undefined,
      $disconnect: async () => undefined,
      _internalMarker: "still readable",
    };

    const unguarded = withStubGuard(stubLike, false);
    expect(unguarded).toBe(stubLike);

    const guarded = withStubGuard(stubLike, true) as typeof stubLike;
    expect(() => guarded.outboxMessage).toThrow(PrismaClientUnavailableError);
    expect(() => guarded.$transaction).toThrow(PrismaClientUnavailableError);
    // Cleanup and non-query surface must keep working so /health/live stays 200.
    expect(typeof guarded.$disconnect).toBe("function");
    expect(guarded._internalMarker).toBe("still readable");
  });

  it("carries a problem+json shape so routes never answer a bare 500", () => {
    const err = new PrismaClientUnavailableError(
      "Prisma client is the offline stub",
      "PRISMA_CLIENT_NOT_GENERATED",
      "rebuild so postinstall runs prisma generate"
    );
    const problem = mapErrorToProblem(err, CORR);
    expect(problem.status).toBe(503);
    expect(problem.title).toBe("Service unavailable");
    expect(problem.code).toBe("PRISMA_CLIENT_NOT_GENERATED");
    expect(problem.dependency).toBe("database");
    expect(problem.detail).toBe("rebuild so postinstall runs prisma generate");
  });
});

describe("platform failures map to diagnosable problems", () => {
  it("a missing Postgres URL becomes 503 CONFIG_MISSING on the database dependency", () => {
    let thrown: unknown;
    try {
      resolveDatabaseUrls({});
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    const configError = new ConfigError((thrown as Error).message, {
      dependency: "database",
      code: "CONFIG_MISSING",
      detail: "no connection string in this environment",
    });
    const problem = mapErrorToProblem(configError, CORR);
    expect(problem.status).toBe(503);
    expect(problem.code).toBe("CONFIG_MISSING");
    expect(problem.dependency).toBe("database");
    expect(problem.title).toBe("Service unavailable");
  });

  it("a non-dependency config error keeps dependency absent", () => {
    const problem = mapErrorToProblem(new ConfigError("APP_ORIGIN is invalid", { code: "CONFIG_INVALID" }), CORR);
    expect(problem.status).toBe(503);
    expect(problem.code).toBe("CONFIG_INVALID");
    expect(problem.dependency).toBeUndefined();
  });

  it("unrelated errors keep the generic unexpected-failure shape", () => {
    const problem = mapErrorToProblem(new Error("boom postgres://user:pass@localhost/db"), CORR);
    expect(problem.status).toBe(500);
    expect(problem.code).toBe("UNEXPECTED_FAILURE");
    expect(JSON.stringify(problem)).not.toContain("postgres://");
  });
});
