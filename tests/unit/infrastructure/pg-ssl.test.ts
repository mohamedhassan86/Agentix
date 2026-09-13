import { describe, it, expect, afterEach } from "vitest";
import { resolveDatabaseSsl, isLocalHostname } from "@/infrastructure/config/database-url";

const asEnv = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const SUPABASE_POOLER = "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true";

describe("TLS resolution for the pg pool", () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it("requires TLS for hosted databases even when the URL says nothing about it", () => {
    // The bug this guards: `pg` does not default to TLS, and hosted Postgres closes a
    // plaintext handshake with no error code -> an undiagnosable "connection_failed".
    const resolved = resolveDatabaseSsl(SUPABASE_POOLER, asEnv({}));
    expect(resolved.mode).toBe("require");
    expect(resolved.source).toBe("default");
    expect(resolved.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("keeps TLS off for local development", () => {
    expect(resolveDatabaseSsl("postgresql://test:test@localhost:5432/agentix_test", asEnv({})).ssl).toBe(false);
    expect(resolveDatabaseSsl("postgresql://test:test@127.0.0.1:5432/agentix_test", asEnv({})).ssl).toBe(false);
    expect(resolveDatabaseSsl("postgresql://test:test@postgres.internal:5432/agentix_test", asEnv({})).ssl).toBe(false);
    expect(isLocalHostname("LOCALHOST")).toBe(true);
    expect(isLocalHostname("db.abcdefgh.supabase.co")).toBe(false);
  });

  it("strips SSL parameters from the connection string so the explicit value governs", () => {
    // pg merges the parsed connection string *over* the explicit config, and its own
    // sslmode=require handling now maps to verify-full - so the parameter must not survive.
    const resolved = resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=verify-full&sslrootcert=/tmp/ca.pem`, asEnv({}));
    expect(resolved.connectionString).not.toContain("sslmode");
    expect(resolved.connectionString).not.toContain("sslrootcert");
    expect(resolved.connectionString).toContain("pgbouncer=true");
    expect(resolved.mode).toBe("verify-full");
    expect(resolved.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("honours an explicit sslmode=disable for a hosted host", () => {
    const resolved = resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=disable`, asEnv({}));
    expect(resolved.mode).toBe("disable");
    expect(resolved.ssl).toBe(false);
  });

  it("treats libpq's weaker modes as encrypt-without-verification", () => {
    expect(resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=prefer`, asEnv({})).mode).toBe("require");
    expect(resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=no-verify`, asEnv({})).mode).toBe("require");
  });

  it("lets PG_SSL_MODE override the URL for deployment control", () => {
    const forced = resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=disable`, asEnv({ PG_SSL_MODE: "require" }));
    expect(forced.mode).toBe("require");
    expect(forced.source).toBe("env");

    const disabled = resolveDatabaseSsl(SUPABASE_POOLER, asEnv({ PG_SSL_MODE: "disable" }));
    expect(disabled.ssl).toBe(false);
    expect(disabled.source).toBe("env");
  });

  it("loads a provider CA when PG_SSL_CA is set", () => {
    const resolved = resolveDatabaseSsl(`${SUPABASE_POOLER}&sslmode=verify-full`, asEnv({ PG_SSL_CA: "package.json" }));
    expect(resolved.ssl).toMatchObject({ rejectUnauthorized: true });
    expect((resolved.ssl as { ca?: string }).ca).toContain("agentix");
  });

  it("ignores an unreadable PG_SSL_CA path instead of throwing at startup", () => {
    const resolved = resolveDatabaseSsl(SUPABASE_POOLER, asEnv({ PG_SSL_CA: "/tmp/does-not-exist-ca.pem" }));
    expect(resolved.ssl).toEqual({ rejectUnauthorized: false });
  });

  it("does not throw on an unparseable connection string", () => {
    const resolved = resolveDatabaseSsl("not-a-url", asEnv({}));
    expect(resolved.connectionString).toBe("not-a-url");
    expect(resolved.ssl).toBe(false);
  });
});

describe("pg pool construction", () => {
  it("applies the resolved TLS mode to the pool", async () => {
    const { createPgPool } = await import("@/infrastructure/persistence/pg");
    const originalEnv = { ...process.env };
    try {
      process.env.DATABASE_URL = SUPABASE_POOLER;
      const hosted = createPgPool();
      expect(hosted.options.ssl).toEqual({ rejectUnauthorized: false });
      await hosted.end();

      process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/agentix_test";
      const local = createPgPool();
      expect(local.options.ssl).toBe(false);
      await local.end();
    } finally {
      process.env = originalEnv;
    }
  });

  it("keeps a caller-supplied ssl/connectionString override", async () => {
    const { createPgPool } = await import("@/infrastructure/persistence/pg");
    const pool = createPgPool({ connectionString: SUPABASE_POOLER, ssl: { rejectUnauthorized: true } });
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
    await pool.end();
  });
});
