import { describe, expect, it } from "vitest";
import {
  APP_URL_ENV_VARS,
  describeDatabaseUrls,
  ensureTls,
  looksLikePooler,
  poolTuning,
  redactConnectionString,
  resolveDatabaseUrls,
} from "@/infrastructure/config/database-url";
import { loadConfig } from "@/infrastructure/config/load-config";

const POOLED =
  "postgresql://neondb_owner:npg_S3cr3t@ep-cool-pond-pooler.c-2.us-east-2.aws.neon.tech:5432/neondb?sslmode=require";
const PGBOUNCER_POOLED =
  "postgresql://user:pass@db.abc123.pooler.example.com:6543/postgres?pgbouncer=true&connect_timeout=15";

describe("Vercel/Neon connection string resolution", () => {
  it("accepts the integration's POSTGRES_URL when DATABASE_URL is absent", () => {
    const resolved = resolveDatabaseUrls({
      POSTGRES_URL: POOLED,
      POSTGRES_URL_NON_POOLING: "postgresql://user:pass@ep-cool-pond.c-2.us-east-2.aws.neon.tech:5432/neondb",
    });
    expect(resolved.appUrl).toBe(POOLED);
    expect(resolved.appUrlSource).toBe("POSTGRES_URL");
    expect(resolved.directUrlSource).toBe("POSTGRES_URL_NON_POOLING");
  });

  it("prefers DATABASE_URL over the platform variables", () => {
    const resolved = resolveDatabaseUrls({
      DATABASE_URL: "postgresql://a:b@localhost:5432/db",
      POSTGRES_URL: POOLED,
    });
    expect(resolved.appUrlSource).toBe("DATABASE_URL");
  });

  it("fails with a remediation naming every accepted variable and no secret", () => {
    let message = "";
    try {
      resolveDatabaseUrls({});
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    for (const name of APP_URL_ENV_VARS) expect(message).toContain(name);
    expect(message).not.toContain("npg_");
    expect(message.toLowerCase()).toMatch(/remediation/);
  });

  it("treats a pooler host as pooled and refuses to reuse it for migrations", () => {
    const resolved = resolveDatabaseUrls({ DATABASE_URL: PGBOUNCER_POOLED });
    expect(resolved.usesPooler).toBe(true);
    expect(resolved.directUrl).toBeNull();
    expect(looksLikePooler(POOLED)).toBe(true);
    expect(looksLikePooler("postgresql://u:p@localhost:5432/db")).toBe(false);
  });

  it("reuses the runtime URL for migrations when it is already direct", () => {
    const direct = "postgresql://u:p@ep-raw.c-2.us-east-2.aws.neon.tech:5432/neondb?sslmode=require";
    const resolved = resolveDatabaseUrls({ DATABASE_URL: direct });
    expect(resolved.directUrl).toBe(direct);
    expect(resolved.usesPooler).toBe(false);
  });

  it("enforces TLS for remote hosts only", () => {
    const remote = ensureTls("postgresql://u:p@ep-x.us-east-2.aws.neon.tech:5432/db");
    expect(remote.url).toContain("sslmode=require");
    expect(remote.forced).toBe(true);

    expect(ensureTls("postgresql://test:test@localhost:5432/agentix_test").url).not.toContain("sslmode");
    expect(ensureTls("postgresql://u:p@host.example.com:5432/db?sslmode=disable", {}).url).toContain("sslmode=require");
    expect(
      ensureTls("postgresql://u:p@host.example.com:5432/db?sslmode=disable", { DB_ALLOW_INSECURE_TLS: "true" }).url
    ).toContain("sslmode=disable");
  });

  it("honours the non-production escape hatches only", () => {
    const remote = "postgresql://u:p@db.example.com:6543/postgres?pgbouncer=true";
    expect(ensureTls(remote, { DB_SSL_NO_VERIFY: "true" }).url).toContain("sslmode=no-verify");
    expect(ensureTls(remote, { DB_ALLOW_INSECURE_TLS: "true" }).url).toBe(remote);
    // In production neither hatch may weaken TLS.
    expect(ensureTls(remote, { DB_SSL_NO_VERIFY: "true", NODE_ENV: "production" }).url).toContain("sslmode=require");
    expect(ensureTls(remote, { DB_ALLOW_INSECURE_TLS: "true", NODE_ENV: "production" }).url).toContain("sslmode=require");
  });

  it("keeps the database name and other params untouched when adding sslmode", () => {
    const out = ensureTls("postgresql://u:p@h.example.com:5432/mydb?connect_timeout=15").url;
    expect(out).toBe("postgresql://u:p@h.example.com:5432/mydb?connect_timeout=15&sslmode=require");
    expect(out.endsWith("/")).toBe(false);
  });

  it("redacts credentials for logging", () => {
    const redacted = redactConnectionString(POOLED);
    expect(redacted).not.toContain("S3cr3t");
    expect(redacted).toContain("neondb_owner@");
    expect(redactConnectionString("not a url")).toBe("<unparseable connection string>");
  });

  it("sizes the pool for serverless and honours overrides", () => {
    expect(poolTuning(true, {})).toMatchObject({ max: 3, connectionTimeoutMillis: 10000 });
    expect(poolTuning(false, {})).toMatchObject({ max: 10 });
    const tuned = poolTuning(true, {
      DB_POOL_MAX: "1",
      DB_CONNECTION_TIMEOUT_MS: "20000",
      DB_STATEMENT_TIMEOUT_MS: "5000",
    });
    expect(tuned).toMatchObject({ max: 1, connectionTimeoutMillis: 20000, statementTimeoutMs: 5000 });
    // Garbage input must not produce an unusable pool.
    expect(poolTuning(false, { DB_POOL_MAX: "0" }).max).toBe(10);
  });

  it("exposes safe metadata through the app config", () => {
    const cfg = loadConfig({
      POSTGRES_URL: POOLED,
      NODE_ENV: "production",
      APP_ORIGIN: "https://agentix.example.com",
    } as NodeJS.ProcessEnv);
    expect(cfg.database.source).toBe("POSTGRES_URL");
    expect(cfg.database.usesPooler).toBe(true);
    expect(cfg.database.hasDirectUrl).toBe(false);
    expect(JSON.stringify(cfg)).not.toContain("S3cr3t");
    expect(describeDatabaseUrls(resolveDatabaseUrls({ POSTGRES_URL: POOLED })).redacted).toContain("neondb");
  });
});
