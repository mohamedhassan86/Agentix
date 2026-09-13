import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";

/** The diagnostic must always name the next action, and never print a credential. */
function runDiagnose(env: Record<string, string>, args: string[] = []) {
  const result = spawnSync(process.execPath, ["scripts/db-diagnose.mjs", ...args], {
    encoding: "utf-8",
    timeout: 40_000,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } as unknown as NodeJS.ProcessEnv,
  });
  return { status: result.status, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("db:diagnose", () => {
  it("fails with the variable names when nothing is configured", () => {
    const { status, output } = runDiagnose({});
    expect(status).toBe(1);
    expect(output).toMatch(/DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL, SUPABASE_DB_URL/);
    expect(output).toMatch(/FIX:/);
  });

  it("reports the resolved target and the TLS mode the app will use", () => {
    const { status, output } = runDiagnose({
      DATABASE_URL: "postgresql://postgres.abc:supersecret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true",
    });
    // No outbound network here: the run stops at TCP, but it must already have shown the
    // target and that TLS is on by default (the bug behind "connection_failed").
    expect(output).toContain("aws-0-eu-west-1.pooler.supabase.com:6543/postgres");
    expect(output).toMatch(/tls: mode=require \(from default\)/);
    expect(output).not.toContain("supersecret");
    expect(status).toBe(1);
  });

  it("points at the port/firewall when TCP is refused", () => {
    const { status, output } = runDiagnose({ DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:5999/postgres" });
    expect(status).toBe(1);
    expect(output).toMatch(/tcp connect: could not connect/);
    expect(output).toMatch(/ECONNREFUSED/);
    expect(output).toMatch(/6543 pooled, 5432 session\/direct/);
  });

  it("warns when no direct URL is available for migrations", () => {
    const { output } = runDiagnose({ DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:5999/postgres" });
    expect(output).toMatch(/DIRECT_URL \/ POSTGRES_URL_NON_POOLING is not set/);
  });

  it("emits a machine-readable report with --json", () => {
    const { output } = runDiagnose({ DATABASE_URL: "postgresql://postgres:pw@127.0.0.1:5999/postgres" }, ["--json"]);
    const report = JSON.parse(output) as { ok: boolean; steps: Array<{ name: string; status: string }> };
    expect(report.ok).toBe(false);
    expect(report.steps.some((step) => step.name === "tcp connect" && step.status === "fail")).toBe(true);
  });
});

describe("db:diagnose TLS stage", () => {
  it("identifies a TLS-only endpoint and prescribes sslmode=require", async () => {
    const net = await import("node:net");
    // A plaintext TCP port that drops any connection: exactly what a TLS-required Postgres
    // looks like to a client that speaks plaintext first.
    const server = net.createServer((socket) => socket.destroy());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as { port: number }).port;

    try {
      const { status, output } = runDiagnose({
        DATABASE_URL: `postgresql://postgres:pw@127.0.0.1:${port}/postgres`,
        PG_SSL_MODE: "require",
        DIAGNOSE_TIMEOUT_MS: "2000",
      });
      expect(status).toBe(1);
      expect(output).toMatch(/\[FAIL\] tls handshake: TLS handshake failed/);
      expect(output).toMatch(/FIX:/);
      expect(output).not.toContain("pw@");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
