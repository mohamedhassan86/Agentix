import { describe, it, expect } from "vitest";
import { MigrationReadinessProbe, PROBE_TIMEOUT_MS } from "@/infrastructure/persistence/migration-readiness";

interface QueryCall {
  sql: string;
  params?: unknown[];
}

/**
 * Fake pg client: each query returns the row set keyed by a matcher, so the probe can be
 * exercised for every readiness branch without a database.
 */
function fakePool(handler: (call: QueryCall) => { rows: Array<Record<string, unknown>> }) {
  const calls: QueryCall[] = [];
  return {
    calls,
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        const call = { sql, params };
        calls.push(call);
        return handler(call);
      },
      release: () => {
        /* no-op */
      },
    }),
  };
}

const READY_HANDLER = (call: QueryCall) => {
  if (call.sql.includes("to_regclass") && String(call.params?.[0]).includes("_prisma_migrations")) {
    return { rows: [{ present: "_prisma_migrations" }] };
  }
  if (call.sql.includes("to_regclass")) return { rows: [{ present: "outbox_messages" }] };
  if (call.sql.includes("_prisma_migrations")) return { rows: [{ migration_name: "20250912000000_001_solution_foundation" }] };
  return { rows: [] };
};

const environment = { DATABASE_URL: "postgresql://test:test@localhost:5432/agentix_test" } as unknown as NodeJS.ProcessEnv;

describe("migration readiness probe", () => {
  it("is ready when the foundation migration is recorded", async () => {
    const pool = fakePool(READY_HANDLER);
    const probe = new MigrationReadinessProbe({ getPool: () => pool, env: environment });

    await expect(probe.check()).resolves.toEqual({ status: "ready" });
    expect(pool.calls[0].sql).toBe("SELECT 1");
  });

  it("reports a missing connection string without touching the pool", async () => {
    const probe = new MigrationReadinessProbe({
      getPool: () => fakePool(READY_HANDLER),
      env: {} as unknown as NodeJS.ProcessEnv,
    });

    await expect(probe.check()).resolves.toMatchObject({
      status: "not_ready",
      dependency: "database",
      reason: "database_url_missing",
    });
  });

  it("reports a missing migration table as a schema failure", async () => {
    const pool = fakePool((call) => {
      if (call.sql.includes("to_regclass")) return { rows: [{ present: null }] };
      return { rows: [] };
    });
    const probe = new MigrationReadinessProbe({ getPool: () => pool, env: environment });

    await expect(probe.check()).resolves.toMatchObject({
      status: "not_ready",
      dependency: "schema",
      reason: "migration_table_missing",
    });
  });

  it("reports an empty migration history as a schema failure", async () => {
    const pool = fakePool((call) => {
      if (call.sql.includes("to_regclass")) return { rows: [{ present: "_prisma_migrations" }] };
      if (call.sql.includes("_prisma_migrations")) return { rows: [] };
      return { rows: [] };
    });
    const probe = new MigrationReadinessProbe({ getPool: () => pool, env: environment });

    await expect(probe.check()).resolves.toMatchObject({ status: "not_ready", dependency: "schema", reason: "no_migrations_applied" });
  });

  it("distinguishes a missing foundation migration from a drifted history", async () => {
    const handler = (tablesPresent: boolean) => (call: QueryCall) => {
      if (call.sql.includes("to_regclass") && String(call.params?.[0]).includes("_prisma_migrations")) {
        return { rows: [{ present: "_prisma_migrations" }] };
      }
      if (call.sql.includes("to_regclass")) return { rows: [{ present: tablesPresent ? "outbox_messages" : null }] };
      if (call.sql.includes("_prisma_migrations")) return { rows: [{ migration_name: "20250101000000_other_migration" }] };
      return { rows: [] };
    };

    const drifted = new MigrationReadinessProbe({ getPool: () => fakePool(handler(true)), env: environment });
    await expect(drifted.check()).resolves.toMatchObject({ reason: "migration_history_drift", dependency: "schema" });

    const empty = new MigrationReadinessProbe({ getPool: () => fakePool(handler(false)), env: environment });
    await expect(empty.check()).resolves.toMatchObject({ reason: "foundation_migration_not_applied", dependency: "schema" });
  });

  it("classifies connection failures instead of reporting a generic error", async () => {
    const refused = new MigrationReadinessProbe({
      getPool: () => ({
        connect: async () => {
          throw Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
        },
      }),
      env: environment,
    });
    await expect(refused.check()).resolves.toMatchObject({ reason: "connection_refused", dependency: "database" });

    const auth = new MigrationReadinessProbe({
      getPool: () => ({
        connect: async () => {
          throw Object.assign(new Error("password authentication failed"), { code: "28P01" });
        },
      }),
      env: environment,
    });
    await expect(auth.check()).resolves.toMatchObject({ reason: "authentication_failed", dependency: "database" });
  });

  it("reports an unclassified driver failure as connection_failed without leaking the message", async () => {
    const probe = new MigrationReadinessProbe({
      getPool: () => ({
        connect: async () => {
          throw new Error("boom postgres://user:supersecret@host/db");
        },
      }),
      env: environment,
    });

    const result = await probe.check();
    expect(result).toMatchObject({ status: "not_ready", dependency: "database", reason: "connection_failed" });
    expect(JSON.stringify(result)).not.toContain("supersecret");
    expect(JSON.stringify(result)).not.toContain("postgres://");
  });

  it("reports a TLS handshake failure instead of a generic connection failure", async () => {
    const probe = new MigrationReadinessProbe({
      getPool: () => ({
        connect: async () => {
          // What `pg` raises when a hosted database closes a plaintext handshake.
          throw Object.assign(new Error("write EPROTO 1234:error:100000f7:SSL routines:OPENSSL_internal:WRONG_VERSION_NUMBER"), {
            code: "EPROTO",
          });
        },
      }),
      env: environment,
    });

    const result = await probe.check();
    expect(result).toMatchObject({ status: "not_ready", dependency: "database", reason: "tls_handshake_failed" });
    expect(JSON.stringify(result)).not.toContain("OPENSSL");
  });

  it("bounds every query with a timeout budget", async () => {
    const hanging = new MigrationReadinessProbe({
      getPool: () => ({ connect: () => new Promise(() => undefined) as never }),
      timeoutMs: 25,
      env: environment,
    });

    const result = await hanging.check();
    expect(result).toMatchObject({ status: "not_ready", dependency: "database", reason: "connection_timeout" });
    expect(PROBE_TIMEOUT_MS).toBe(2000);
  });
});
