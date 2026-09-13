import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

/**
 * The migration runner is the build step that keeps the deployed schema in sync.
 * These cases cover the paths that must never contact a database, so they are safe
 * to run anywhere.
 */
function runScript(env: Record<string, string>) {
  const result = spawnSync(process.execPath, ["scripts/migrate-deploy.mjs"], {
    encoding: "utf-8",
    timeout: 30_000,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      ...env,
    },
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("production migration runner", () => {
  it("skips without a database and does not fail a non-Vercel build", () => {
    const { status, output } = runScript({});
    expect(status).toBe(0);
    expect(output).toMatch(/no connection string found/i);
    expect(output).toMatch(/skipping migrations/i);
  });

  it("fails a Vercel production build when no database is configured, with remediation", () => {
    const { status, output } = runScript({ VERCEL: "1", VERCEL_ENV: "production" });
    expect(status).toBe(1);
    expect(output).toMatch(/DATABASE_URL/);
    expect(output).toMatch(/FIX:/);
  });

  it("does not fail a preview build with no database", () => {
    const { status, output } = runScript({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(status).toBe(0);
    expect(output).toMatch(/production builds only/i);
  });

  it("never applies migrations from a preview build, even with only a pooled URL", () => {
    const { status, output } = runScript({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      POSTGRES_PRISMA_URL: "postgresql://postgres.abc:supersecret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    });
    // Regression: a pooled-only preview environment must not turn the PR check red.
    expect(status).toBe(0);
    expect(output).toMatch(/production builds only/i);
    expect(output).toContain("aws-0-eu-west-1.pooler.supabase.com:6543/postgres");
    expect(output).not.toContain("supersecret");
  });

  it("skips (not fails) a pooler-only preview build that explicitly opts in", () => {
    const { status, output } = runScript({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DB_MIGRATE_ON_PREVIEW: "true",
      POSTGRES_PRISMA_URL: "postgresql://postgres.abc:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    });
    expect(status).toBe(0);
    expect(output).toMatch(/transaction pooler/i);
    expect(output).toMatch(/skipping/i);
  });

  it("cannot fail a preview build even when the migration run fails", () => {
    const { status, output } = runScript({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DB_MIGRATE_ON_PREVIEW: "true",
      // Unroutable direct target: the run must fail softly, never break the build.
      DIRECT_URL: "postgresql://postgres.abc:pw@127.0.0.1:1/postgres",
      MIGRATE_TIMEOUT_MS: "4000",
    });
    expect(status).toBe(0);
    expect(output).toMatch(/DB_MIGRATE_ON_PREVIEW=true - this preview build continues/i);
  });

  it("honours SKIP_DB_MIGRATE", () => {
    const { status, output } = runScript({
      VERCEL: "1",
      VERCEL_ENV: "production",
      SKIP_DB_MIGRATE: "true",
      DATABASE_URL: "postgresql://user:supersecret@localhost:5432/db",
    });
    expect(status).toBe(0);
    expect(output).toMatch(/SKIP_DB_MIGRATE/);
    expect(output).not.toContain("supersecret");
  });

  it("refuses to run production migrations through a transaction pooler (port 6543)", () => {
    const { status, output } = runScript({
      VERCEL: "1",
      VERCEL_ENV: "production",
      DIRECT_URL: "postgresql://user:supersecret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
    });
    expect(status).toBe(1);
    expect(output).toMatch(/6543/);
    expect(output).toMatch(/5432/);
    expect(output).toMatch(/DIRECT_URL/);
    // Reports the target without the credential
    expect(output).toContain("aws-0-eu-west-1.pooler.supabase.com:6543/postgres");
    expect(output).not.toContain("supersecret");
  });

  it("rejects a non-Postgres connection string", () => {
    const { status, output } = runScript({ DATABASE_URL: "mysql://user:pass@localhost:3306/db" });
    expect(status).toBe(1);
    expect(output).toMatch(/not a Postgres URL/i);
  });

  it("accepts DB_MIGRATE_OPTIONAL as an escape hatch for pooled-only environments", () => {
    const { status, output } = runScript({
      DIRECT_URL: "postgresql://user:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres",
      DB_MIGRATE_OPTIONAL: "true",
    });
    expect(status).toBe(0);
    expect(output).toMatch(/DB_MIGRATE_OPTIONAL/);
  });
});
