import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  RUNTIME_DATABASE_URL_KEYS,
  MIGRATION_DATABASE_URL_KEYS,
  resolveRuntimeDatabaseUrl,
  resolveMigrationDatabaseUrl,
  resolveDatabaseUrl,
  describeConnectionTarget,
  isPostgresUrl,
} from "@/infrastructure/config/database-url";

/** ProcessEnv is augmented with a required NODE_ENV by Next.js types. */
const asEnv = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe("database connection string resolution", () => {
  it("prefers the canonical DATABASE_URL", () => {
    const resolved = resolveRuntimeDatabaseUrl(
      asEnv({ DATABASE_URL: "postgresql://canonical@host:5432/db", POSTGRES_PRISMA_URL: "postgresql://integration@host:6543/db" })
    );
    expect(resolved).toEqual({ url: "postgresql://canonical@host:5432/db", source: "DATABASE_URL" });
  });

  it("falls back to the names the Supabase Vercel integration injects", () => {
    const resolved = resolveRuntimeDatabaseUrl(asEnv({ POSTGRES_PRISMA_URL: "postgresql://pooler@host:6543/db" }));
    expect(resolved).toEqual({ url: "postgresql://pooler@host:6543/db", source: "POSTGRES_PRISMA_URL" });

    const plain = resolveRuntimeDatabaseUrl(asEnv({ POSTGRES_URL: "postgresql://pooler@host:6543/db" }));
    expect(plain?.source).toBe("POSTGRES_URL");
  });

  it("ignores empty and whitespace-only values", () => {
    expect(resolveRuntimeDatabaseUrl(asEnv({ DATABASE_URL: "   ", POSTGRES_URL: "postgresql://host/db" }))?.source).toBe(
      "POSTGRES_URL"
    );
    expect(resolveRuntimeDatabaseUrl(asEnv({}))).toBeNull();
  });

  it("prefers a direct connection for migrations", () => {
    const values = {
      DATABASE_URL: "postgresql://pooler@host:6543/db",
      DIRECT_URL: "postgresql://direct@host:5432/db",
      POSTGRES_URL_NON_POOLING: "postgresql://non-pooling@host:5432/db",
    };
    expect(resolveMigrationDatabaseUrl(asEnv(values))).toEqual({
      url: "postgresql://direct@host:5432/db",
      source: "DIRECT_URL",
    });
    expect(resolveMigrationDatabaseUrl(asEnv({ ...values, DIRECT_URL: "" }))).toEqual({
      url: "postgresql://non-pooling@host:5432/db",
      source: "POSTGRES_URL_NON_POOLING",
    });
    // Without a direct URL the pooled runtime URL is the last resort, not the first choice.
    expect(resolveMigrationDatabaseUrl(asEnv({ DATABASE_URL: values.DATABASE_URL }))?.source).toBe("DATABASE_URL");
  });

  it("routes by purpose", () => {
    const values = { DATABASE_URL: "postgresql://pooled@host:6543/db", DIRECT_URL: "postgresql://direct@host:5432/db" };
    expect(resolveDatabaseUrl("runtime", asEnv(values))?.source).toBe("DATABASE_URL");
    expect(resolveDatabaseUrl("migration", asEnv(values))?.source).toBe("DIRECT_URL");
  });

  it("describes a connection target without credentials", () => {
    const target = describeConnectionTarget(
      "postgresql://user:supersecret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    );
    expect(target).toEqual({
      host: "aws-0-eu-west-1.pooler.supabase.com",
      port: "6543",
      database: "postgres",
      transactionPooler: true,
    });
    expect(JSON.stringify(target)).not.toContain("supersecret");
    expect(JSON.stringify(target)).not.toContain("user");
  });

  it("flags non-pooler targets as safe for migrations", () => {
    const direct = describeConnectionTarget("postgresql://user:pw@db.abcdefgh.supabase.co:5432/postgres");
    expect(direct?.transactionPooler).toBe(false);
    expect(describeConnectionTarget("not-a-url")).toBeNull();
  });

  it("recognises postgres URLs", () => {
    expect(isPostgresUrl("postgresql://host/db")).toBe(true);
    expect(isPostgresUrl("postgres://host/db")).toBe(true);
    expect(isPostgresUrl("mysql://host/db")).toBe(false);
  });

  it("keeps the same variable names as the deploy migration script", () => {
    const script = readFileSync("scripts/migrate-deploy.mjs", "utf-8");
    const match = script.match(/const MIGRATION_DATABASE_URL_KEYS = \[([\s\S]*?)\];/);
    expect(match, "migrate-deploy.mjs should declare MIGRATION_DATABASE_URL_KEYS").toBeTruthy();
    const scriptKeys = [...match![1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
    expect(scriptKeys).toEqual([...MIGRATION_DATABASE_URL_KEYS]);
    // Runtime keys must be a subset of what the migration list accepts.
    for (const key of RUNTIME_DATABASE_URL_KEYS) {
      expect(scriptKeys).toContain(key);
    }
  });
});
