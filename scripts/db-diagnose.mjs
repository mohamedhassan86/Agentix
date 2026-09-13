#!/usr/bin/env node
/**
 * Database path diagnostics: reports exactly where the connection fails, using the same
 * resolution, TLS rules and pool settings as the deployed app.
 *
 * Usage:
 *   node scripts/db-diagnose.mjs               # uses the environment / .env* files
 *   node scripts/db-diagnose.mjs --json        # machine-readable report
 *
 * Steps: variable resolution -> host/port -> TCP -> TLS -> authentication -> SELECT 1 ->
 * migration history. Every failure prints a diagnosis and a fix. Never prints the credential:
 * only the variable name and host:port/database.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";
import net from "node:net";
import tls from "node:tls";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const asJson = process.argv.includes("--json");

const RUNTIME_KEYS = ["DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL", "SUPABASE_DB_URL"];
const MIGRATION_KEYS = ["DIRECT_URL", "POSTGRES_URL_NON_POOLING", ...RUNTIME_KEYS];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) loadDotenv({ path });
}

const steps = [];
function record(name, status, detail, fix) {
  steps.push({ name, status, detail, fix });
  if (!asJson) {
    const icon = status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
    console.log(`[${icon}] ${name}: ${detail}`);
    if (fix) console.log(`       FIX: ${fix}`);
  }
}

function firstValue(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim().length > 0) return { url: value.trim(), source: key };
  }
  return null;
}

function targetOf(url) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, "") || "(default)",
    url: parsed,
  };
}

function isLocal(host) {
  const h = host.toLowerCase();
  return LOCAL_HOSTS.has(h) || h.endsWith(".local") || h.endsWith(".internal");
}

function sslModeFor(parsedUrl, host) {
  const envMode = (process.env.PG_SSL_MODE ?? "").trim().toLowerCase();
  if (["disable", "require", "verify-ca", "verify-full"].includes(envMode)) return { mode: envMode, source: "PG_SSL_MODE" };
  const urlMode = (parsedUrl.searchParams.get("sslmode") ?? "").toLowerCase();
  if (["disable", "require", "verify-ca", "verify-full"].includes(urlMode)) return { mode: urlMode, source: "DATABASE_URL sslmode" };
  if (["prefer", "allow", "no-verify"].includes(urlMode)) return { mode: "require", source: "DATABASE_URL sslmode" };
  // Mirrors src/infrastructure/config/database-url.ts resolveDatabaseSsl()
  return { mode: isLocal(host) ? "disable" : "require", source: "default" };
}

const PROBE_TIMEOUT_MS = Number(process.env.DIAGNOSE_TIMEOUT_MS ?? 5000);

function tcpProbe(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolvePromise) => {
    const socket = net.connect({ host, port });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done({ ok: true }));
    socket.once("timeout", () => done({ ok: false, code: "ETIMEDOUT" }));
    socket.once("error", (error) => done({ ok: false, code: error.code ?? error.name }));
  });
}

function tlsProbe(host, port, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolvePromise) => {
    const socket = tls.connect({ host, port, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false });
    const done = (result) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(result);
    };
    socket.setTimeout(timeoutMs, () => done({ ok: false, code: "ETIMEDOUT" }));
    socket.once("secureConnect", () =>
      done({ ok: true, protocol: socket.getProtocol(), authorized: socket.authorized, authorizationError: socket.authorizationError })
    );
    socket.once("error", (error) => done({ ok: false, code: error.code ?? error.name }));
    socket.once("close", () => done({ ok: false, code: "connection_closed" }));
  });
}

function pgClient(connectionString, ssl) {
  return new Client({
    connectionString,
    ssl,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10000),
    application_name: "agentix-db-diagnose",
  });
}

const TCP_FIXES = {
  ENOTFOUND: "The host name does not resolve from here. Check the host in the connection string.",
  EAI_AGAIN: "DNS lookup failed temporarily. Re-run in a moment.",
  ECONNREFUSED: "Nothing is listening on that host:port. Check the port (6543 pooled, 5432 session/direct).",
  EHOSTUNREACH: "No route to the host. Supabase direct connections are IPv6-only - use the pooler host, or enable the IPv4 add-on.",
  ENETUNREACH: "No route to the host. Supabase direct connections are IPv6-only - use the pooler host, or enable the IPv4 add-on.",
  ETIMEDOUT: "The connection timed out. The host may be blocked by a firewall or the project may be paused.",
};

async function main() {
  const resolvedHost = { value: null };
  const runtime = firstValue(RUNTIME_KEYS);
  const migration = firstValue(MIGRATION_KEYS);

  if (!runtime) {
    record("connection string", "fail", `none of ${RUNTIME_KEYS.join(", ")} is set`, "Set DATABASE_URL in the host environment (Vercel: Project Settings -> Environment Variables) and redeploy.");
    return finish(1);
  }
  resolvedHost.value = runtime;
  record("connection string", "pass", `using ${runtime.source} (also present: ${RUNTIME_KEYS.filter((k) => process.env[k]).join(", ") || "none"})`);

  if (!process.env.DIRECT_URL && !process.env.POSTGRES_URL_NON_POOLING) {
    record(
      "direct URL (migrations)",
      "warn",
      "DIRECT_URL / POSTGRES_URL_NON_POOLING is not set, so migrations fall back to the pooled URL",
      "Set DIRECT_URL to the session/direct connection on port 5432 so `prisma migrate deploy` can run."
    );
  } else {
    record("direct URL (migrations)", "pass", `using ${process.env.DIRECT_URL ? "DIRECT_URL" : "POSTGRES_URL_NON_POOLING"}`);
  }

  let target;
  try {
    target = targetOf(runtime.url);
  } catch {
    record("connection string format", "fail", "the value is not a valid URL", "Re-copy the connection string from your provider dashboard.");
    return finish(1);
  }
  record("target", "pass", `${target.host}:${target.port}/${target.database} (${target.port === "6543" ? "transaction pooler" : "direct/session"}) - runtime from ${runtime.source}`);
  if (migration && migration.url !== runtime.url) {
    try {
      const migrationTarget = targetOf(migration.url);
      record("migration target", "pass", `${migrationTarget.host}:${migrationTarget.port}/${migrationTarget.database} - from ${migration.source}`);
    } catch {
      record("migration target", "fail", `the value in ${migration.source} is not a valid URL`, "Re-copy the direct/session connection string from the provider dashboard.");
    }
  }

  const { mode: sslMode, source: sslSource } = sslModeFor(target.url, target.host);
  record("tls", "pass", `mode=${sslMode} (from ${sslSource})`);

  const tcp = await tcpProbe(target.host, target.port);
  if (!tcp.ok) {
    record("tcp connect", "fail", `could not connect to ${target.host}:${target.port} (${tcp.code})`, TCP_FIXES[tcp.code] ?? "Check the host, port, and network access from this machine.");
    return finish(1);
  }
  record("tcp connect", "pass", `${target.host}:${target.port} accepted a TCP connection`);

  const tlsResult = await tlsProbe(target.host, target.port);
  if (!tlsResult.ok) {
    record(
      "tls handshake",
      "fail",
      `TLS handshake failed (${tlsResult.code})`,
      tlsResult.code === "connection_closed"
        ? "The server closed the connection during the TLS handshake. Confirm the host/port is a TLS Postgres endpoint (Supabase pooler: *.pooler.supabase.com:6543)."
        : "The endpoint did not complete a TLS handshake. For Supabase use the pooler host (*.pooler.supabase.com)."
    );
    // Nothing further can be learned over a transport that does not negotiate TLS.
    return finish(1);
  } else {
    record(
      "tls handshake",
      "pass",
      `${tlsResult.protocol}${tlsResult.authorized ? "" : `, certificate not verified (${tlsResult.authorizationError ?? "unknown reason"})`}`
    );
    if (!tlsResult.authorized && sslMode.startsWith("verify")) {
      record(
        "tls verification",
        "fail",
        "the server certificate is not trusted by this machine's CA store",
        "Set PG_SSL_CA to the provider's CA certificate, or use PG_SSL_MODE=require (encrypt without chain verification)."
      );
      return finish(1);
    }
  }

  const ssl = sslMode === "disable" ? false : { rejectUnauthorized: sslMode.startsWith("verify") };

  let client;
  try {
    client = pgClient(runtime.url, ssl);
    await client.connect();
    record("authentication", "pass", `connected as a Postgres client (tls=${sslMode !== "disable"})`);
  } catch (error) {
    const code = error.code ?? error.name ?? "unclassified";
    const fixes = {
      "28P01": "The password is wrong for this role/user. Re-copy the connection string.",
      "28000": "The role is not allowed to connect. On Supabase the pooler user looks like postgres.<project-ref>.",
      "3D000": "The database does not exist on this server.",
      "53300": "Too many connections: use the pooler URL and keep PG_POOL_MAX small.",
      EPROTO: "TLS mismatch: add ?sslmode=require to DATABASE_URL or set PG_SSL_MODE=require.",
    };
    const fix =
      fixes[code] ??
      (/terminated unexpectedly/i.test(String(error.message))
        ? "The server closed the connection during startup - almost always a missing TLS handshake. Add ?sslmode=require to DATABASE_URL, or set PG_SSL_MODE=require."
        : "Check the connection string against the provider dashboard.");
    record("authentication", "fail", `login failed (${code})`, fix);
    return finish(1);
  }

  try {
    const version = await client.query("SELECT version() AS v");
    record("query", "pass", String(version.rows[0].v).split(" ").slice(0, 2).join(" "));

    const table = await client.query("SELECT to_regclass($1) AS present", ["public._prisma_migrations"]);
    if (!table.rows[0]?.present) {
      record("migrations", "fail", "no _prisma_migrations table", "Apply migrations with the direct (port 5432) connection: npm run db:migrate:deploy");
      return finish(1);
    }

    const applied = await client.query('SELECT migration_name, finished_at FROM "_prisma_migrations" WHERE finished_at IS NOT NULL');
    const names = applied.rows.map((row) => String(row.migration_name));
    if (!names.some((name) => name.includes("001_solution_foundation"))) {
      record(
        "migrations",
        "fail",
        `001_solution_foundation is not recorded (found: ${names.join(", ") || "none"})`,
        "Run npm run db:migrate:deploy against the direct connection, or mark it with `npx prisma migrate resolve --applied 20250912000000_001_solution_foundation`."
      );
      return finish(1);
    }
    record("migrations", "pass", `001_solution_foundation applied (${names.length} migration row(s))`);

    const tables = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('outbox_messages','outbox_attempts','foundation_demo_requests','foundation_demo_effects')"
    );
    record("foundation tables", tables.rows[0].n === 4 ? "pass" : "fail", `${tables.rows[0].n}/4 present`, tables.rows[0].n === 4 ? undefined : "Re-run migrations; the schema is incomplete.");
    return finish(tables.rows[0].n === 4 ? 0 : 1);
  } catch (error) {
    record("query", "fail", `query failed (${error.code ?? error.name})`, "Verify the role's privileges on this database.");
    return finish(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

function finish(exitCode) {
  if (asJson) {
    console.log(JSON.stringify({ ok: exitCode === 0, steps }, null, 2));
  } else {
    console.log(exitCode === 0 ? "\nDatabase path looks healthy." : "\nDatabase path is NOT healthy - see the failures above.");
    if (exitCode === 0) {
      console.log("Redeploy, then GET /health/ready should answer 200.");
    }
  }
  process.exit(exitCode);
}

main().catch((error) => {
  record("unexpected failure", "fail", String(error?.message ?? error));
  finish(1);
});
