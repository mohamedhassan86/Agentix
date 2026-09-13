/**
 * db:doctor — diagnose why the app cannot talk to PostgreSQL.
 *
 * Runs entirely from the environment (no Next.js), so it reproduces exactly what
 * Vercel will do at runtime: which env var the URL came from, whether the host
 * resolves, whether TLS is required, whether the pooler is in play, and whether
 * the foundation migration has been applied.
 *
 * Usage:
 *   vercel env pull .env.local && npm run db:doctor          # against the Vercel DB
 *   npm run db:doctor -- --json                               # machine-readable output
 * Never prints credentials; hosts/usernames only.
 */
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { lookup } from "node:dns/promises";
import { connect as netConnect, type Socket } from "node:net";
import { connect as tlsConnect } from "node:tls";
import { Pool } from "pg";

import {
  APP_URL_ENV_VARS,
  DIRECT_URL_ENV_VARS,
  describeDatabaseUrls,
  redactConnectionString,
  resolveDatabaseUrls,
} from "../src/infrastructure/config/database-url";
import { classifyConnectionError } from "../src/infrastructure/persistence/connection-error";

const asJson = process.argv.includes("--json");

interface Step {
  name: string;
  ok: boolean;
  detail: string;
  remediation?: string;
}

const steps: Step[] = [];
let failed = false;

function record(step: Step): void {
  steps.push(step);
  if (!step.ok) failed = true;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  return Promise.race([
    promise.finally(() => {
      if (timer) clearTimeout(timer);
    }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { code: "DOCTOR_TIMEOUT" })), ms);
    }),
  ]);
}

function tcpProbe(host: string, port: number, ms: number): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolvePromise) => {
    const start = Date.now();
    const socket: Socket = netConnect({ host, port });
    let settled = false;
    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise({ ok, detail });
    };
    socket.setTimeout(ms, () => finish(false, `no response within ${ms}ms (packet dropped by a firewall/allow-list?)`));
    socket.once("connect", () => finish(true, `TCP reachable in ${Date.now() - start}ms`));
    socket.once("error", (e) => finish(false, `${(e as NodeJS.ErrnoException).code ?? "ERR"}: ${e.message}`));
  });
}

function tlsProbe(host: string, port: number, ms: number): Promise<{ ok: boolean; detail: string }> {
  return new Promise((resolvePromise) => {
    const start = Date.now();
    const socket = tlsConnect({ host, port, servername: host, rejectUnauthorized: false });
    let settled = false;
    const finish = (ok: boolean, detail: string) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise({ ok, detail });
    };
    socket.setTimeout(ms, () => finish(false, `TLS handshake timed out after ${ms}ms`));
    socket.once("secureConnect", () => finish(true, `TLS handshake ok in ${Date.now() - start}ms, protocol=${socket.getProtocol()}`));
    socket.once("error", (e) => finish(false, `TLS error: ${(e as NodeJS.ErrnoException).code ?? ""} ${e.message}`.slice(0, 200)));
  });
}

async function main(): Promise<void> {
  // Same precedence as the app: .env.local then .env; platform env wins because
  // dotenv does not overwrite already-set variables.
  const envLocal = resolve(process.cwd(), ".env.local");
  const envFile = resolve(process.cwd(), ".env");
  if (existsSync(envLocal)) loadDotenv({ path: envLocal });
  else if (existsSync(envFile)) loadDotenv({ path: envFile });

  const present = (names: readonly string[]) => names.filter((n) => !!process.env[n]);

  record({
    name: "environment",
    ok: true,
    detail:
      `vars set -> app candidates: ${present(APP_URL_ENV_VARS).join(", ") || "none"}; ` +
      `direct candidates: ${present(DIRECT_URL_ENV_VARS).join(", ") || "none"}` +
      (present(APP_URL_ENV_VARS).includes("DATABASE_URL") ? "" : " (DATABASE_URL missing)"),
  });

  let resolved: ReturnType<typeof resolveDatabaseUrls>;
  try {
    resolved = resolveDatabaseUrls(process.env);
  } catch (e) {
    record({ name: "resolve-url", ok: false, detail: (e as Error).message });
    report();
    return;
  }

  const info = describeDatabaseUrls(resolved);
  record({
    name: "resolve-url",
    ok: true,
    detail:
      `runtime URL from ${info.source}; direct URL from ${info.directSource ?? "none (will reuse runtime)"}; ` +
      `pooler=${info.usesPooler}; tlsForcedByApp=${info.tlsForced}`,
  });

  let parsed: URL;
  try {
    parsed = new URL(resolved.appUrl);
  } catch {
    record({ name: "parse-url", ok: false, detail: "connection string is not a postgres:// URL" });
    report();
    return;
  }
  const host = parsed.hostname;
  const port = Number(parsed.port || 5432);
  record({
    name: "target",
    ok: true,
    detail: `${redactConnectionString(resolved.appUrl)} (host=${host} port=${port} sslmode=${
      parsed.searchParams.get("sslmode") ?? "unset"
    })`,
  });

  try {
    const addresses = await withTimeout(lookup(host, { all: true }), 5000, "DNS");
    record({ name: "dns", ok: true, detail: `${addresses.map((a) => a.address).join(", ")}` });
  } catch (e) {
    const failure = classifyConnectionError(e);
    record({ name: "dns", ok: false, detail: `${failure.category}: ${(e as Error).message}`, remediation: failure.remediation });
  }

  const tcp = await tcpProbe(host, port, 5000);
  record({ name: "tcp", ok: tcp.ok, detail: tcp.detail, remediation: tcp.ok ? undefined : "Firewall/allow-list or a dead endpoint" });

  const tls = await tlsProbe(host, port, 5000);
  record({ name: "tls", ok: tls.ok, detail: tls.detail, remediation: tls.ok ? undefined : "Hosted Postgres requires TLS; keep sslmode=require" });

  let pool: Pool | null = null;
  try {
    pool = new Pool({
      connectionString: resolved.appUrl,
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 5_000,
    });
    const started = Date.now();
    const client = await withTimeout(pool.connect(), 12_000, "pool.connect");
    try {
      const server = await client.query("SELECT version() AS v");
      record({
        name: "query:select 1",
        ok: true,
        detail: `connected in ${Date.now() - started}ms; ${(server.rows[0].v as string).slice(0, 60)}`,
      });

      const tables = await client.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('outbox_messages','outbox_attempts','_prisma_migrations')`
      );
      const found = Number(tables.rows[0]?.n ?? 0);
      record({
        name: "schema",
        ok: found >= 3,
        detail: `foundation tables present: ${found}/3 (outbox_messages, outbox_attempts, _prisma_migrations)`,
        remediation:
          found >= 3
            ? undefined
            : `Run: DIRECT_URL='${info.hasDirectUrl ? "the non-pooled URL" : "the URL"}' npx prisma migrate deploy (npm run db:migrate). Migrations must not use the pooler.`,
      });

      const pending = await client.query(
        `SELECT count(*)::int AS n FROM outbox_messages WHERE status = 'pending'`
      ).catch(() => null);
      if (pending) {
        record({ name: "outbox", ok: true, detail: `pending work items: ${pending.rows[0]?.n ?? 0} (need a worker; Vercel cannot host the poller)` });
      }
    } finally {
      client.release();
    }
  } catch (e) {
    const failure = classifyConnectionError(e);
    record({ name: "connect", ok: false, detail: `${failure.category} (${failure.code})`, remediation: failure.remediation });
  } finally {
    if (pool) await pool.end().catch(() => undefined);
  }

  report();
}

function report(): void {
  if (asJson) {
    console.log(JSON.stringify({ ok: !failed, steps }, null, 2));
  } else {
    console.log(`\nAgentix database doctor — ${failed ? "FAILURES FOUND" : "all checks passed"}\n`);
    for (const step of steps) {
      console.log(`${step.ok ? "  ok  " : " FAIL "} ${step.name.padEnd(16)} ${step.detail}`);
      if (step.remediation) console.log(`        → ${step.remediation}`);
    }
    console.log("");
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(`db:doctor crashed: ${(e as Error).message}`);
  process.exit(1);
});
