#!/usr/bin/env node
/**
 * Production database migration runner.
 *
 * Why this exists: `next build` alone never applies migrations, so a deploy can ship an
 * application that is ready but whose schema is not - the readiness probe then answers
 * 503 and the UI shows "dependency unavailable". This script is meant to run as part of the
 * host build step (see vercel.json -> npm run build:vercel) or by hand against production.
 *
 * Guarantees:
 * - resolves the direct/session connection string (migrations must not run through a
 *   transaction pooler, which cannot execute session-scoped statements)
 * - never prints a credential: only the source variable name and host:port/database
 * - fails loudly with actionable remediation instead of leaving a half-migrated deploy
 * - idempotent: `prisma migrate deploy` applies only pending migrations
 *
 * Environment:
 * - SKIP_DB_MIGRATE=true        skip entirely (e.g. a preview build with no database)
 * - DB_MIGRATE_OPTIONAL=true    never fail the build; warn instead
 * - DB_MIGRATE_ON_PREVIEW=true  also migrate from Vercel preview/development builds
 *                               (off by default: preview builds share the production
 *                               database URL, so applying migrations there is unsafe and
 *                               never fails the build)
 * - MIGRATE_TIMEOUT_MS=120000   hard timeout for the migration run
 *
 * The accepted variable names mirror src/infrastructure/config/database-url.ts
 * (asserted by tests/unit/infrastructure/database-url.test.ts).
 */
import { spawn } from "node:child_process";

const MIGRATION_DATABASE_URL_KEYS = [
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
];

const isTruthy = (value) => typeof value === "string" && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());

const skip = isTruthy(process.env.SKIP_DB_MIGRATE);
const optional = isTruthy(process.env.DB_MIGRATE_OPTIONAL);
const isVercel = Boolean(process.env.VERCEL);
const vercelEnv = process.env.VERCEL_ENV ?? ""; // production | preview | development
const applyOnPreview = isTruthy(process.env.DB_MIGRATE_ON_PREVIEW);

/**
 * Vercel preview/development builds must never apply migrations: they usually share the
 * production connection string, and a preview build that fails leaves a red check on every
 * PR. Preview therefore skips by default and, when explicitly opted in, still cannot fail
 * the build.
 */
const previewBuild = isVercel && vercelEnv !== "production";
const softFail = previewBuild && applyOnPreview;

function log(message) {
  console.log(`[migrate] ${message}`);
}

function warn(message) {
  console.warn(`[migrate] WARNING: ${message}`);
}

function fail(message, remediation) {
  if (softFail) {
    warn(`${message}${remediation ? ` FIX: ${remediation}` : ""}`);
    warn("DB_MIGRATE_ON_PREVIEW=true - this preview build continues without migrations.");
    process.exit(0);
  }
  console.error(`[migrate] ERROR: ${message}`);
  if (remediation) console.error(`[migrate] FIX: ${remediation}`);
  if (optional) {
    warn("DB_MIGRATE_OPTIONAL=true - continuing without applying migrations.");
    process.exit(0);
  }
  process.exit(1);
}

/** Credential-free view of a connection string: host, port, database only. */
function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "(default)",
      transactionPooler: (parsed.port || "5432") === "6543",
    };
  } catch {
    return null;
  }
}

function resolveMigrationUrl(env) {
  for (const key of MIGRATION_DATABASE_URL_KEYS) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { url: value.trim(), source: key };
    }
  }
  return null;
}

const REASONS = [
  {
    match: /P1000|authentication failed|password authentication failed|28P01|28000/i,
    message: "Postgres rejected the credentials.",
    fix: "Re-copy the connection string and password from the database provider, then update the deployment environment variables.",
  },
  {
    match: /P1001|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|could not connect|can't reach database server/i,
    message: "The database host is unreachable from the build environment.",
    fix: "Check the host/port. Supabase direct connections are IPv6-only - use the session pooler URL (host *.pooler.supabase.com, port 5432) or enable the IPv4 add-on.",
  },
  {
    match: /P1002|ETIMEDOUT|timeout|timed out/i,
    message: "The database did not answer in time.",
    fix: "Verify network access from the build environment and raise MIGRATE_TIMEOUT_MS if the migration is genuinely long.",
  },
  {
    match: /P3005|not empty|failed to apply|P3009|P3018/i,
    message: "The migration history and the database schema disagree.",
    fix: "Run `npx prisma migrate status` against the direct URL. For an existing schema with no history use `npx prisma migrate resolve --applied <migration_name>`.",
  },
  {
    match: /prepared statement|pgbouncer|transaction pooler|session_replication_role/i,
    message: "Migrations cannot run through a transaction-mode pooler.",
    fix: "Point DIRECT_URL (or POSTGRES_URL_NON_POOLING) at the session/direct connection on port 5432; keep the pooled URL on port 6543 for runtime DATABASE_URL.",
  },
  {
    match: /already exists|42P07|42710/i,
    message: "An object from this migration already exists in the database.",
    fix: "The database was migrated outside Prisma's history. Record it with `npx prisma migrate resolve --applied 20250912000000_001_solution_foundation`.",
  },
];

function printFailureDiagnosis(output) {
  for (const reason of REASONS) {
    if (reason.match.test(output)) {
      console.error(`[migrate] DIAGNOSIS: ${reason.message}`);
      console.error(`[migrate] FIX: ${reason.fix}`);
      return;
    }
  }
  console.error("[migrate] DIAGNOSIS: unrecognised migration failure - see the Prisma output above.");
  console.error("[migrate] FIX: run `npm run db:status` against the direct (port 5432) connection to inspect migration state.");
}

function runMigrateDeploy(url, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["prisma", "migrate", "deploy"], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
    });

    let output = "";
    const capture = (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ code: 124, output: `${output}\n[migrate] aborted after ${timeoutMs}ms` });
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, output: `${output}\n${error.message}` });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

async function main() {
  if (skip) {
    log("SKIP_DB_MIGRATE is set - skipping database migrations.");
    return;
  }

  if (previewBuild && !applyOnPreview) {
    const resolved = resolveMigrationUrl(process.env);
    const target = resolved ? describeTarget(resolved.url) : null;
    log(
      `VERCEL_ENV=${vercelEnv || "preview"}: migrations are applied from production builds only` +
        (target ? ` (would target ${target.host}:${target.port}/${target.database} via ${resolved.source})` : "")
    );
    log("Set DB_MIGRATE_ON_PREVIEW=true to apply migrations from preview builds.");
    return;
  }

  const resolved = resolveMigrationUrl(process.env);
  if (!resolved) {
    const message = `no connection string found (looked for: ${MIGRATION_DATABASE_URL_KEYS.join(", ")}).`;
    if (isVercel && vercelEnv !== "preview" && vercelEnv !== "development") {
      fail(
        `${message} A production deployment without a database cannot become ready.`,
        "Add DATABASE_URL and DIRECT_URL to the Vercel project environment variables (Production scope) and redeploy, or set SKIP_DB_MIGRATE=true to deploy without migrations."
      );
    }
    warn(`${message} Skipping migrations for this build (no database configured for this environment).`);
    return;
  }

  if (!/^postgres(ql)?:\/\//i.test(resolved.url)) {
    fail(`the connection string in ${resolved.source} is not a Postgres URL.`, "Use a postgresql:// connection string.");
  }

  const target = describeTarget(resolved.url);
  if (!target) {
    fail(`the connection string in ${resolved.source} could not be parsed.`, "Re-copy the connection string from the provider dashboard.");
  }

  log(`source=${resolved.source} target=${target.host}:${target.port}/${target.database}`);

  if (target.transactionPooler) {
    if (softFail) {
      warn(
        `${resolved.source} points at port 6543 (transaction pooler), which cannot run migrations - skipping. Set DIRECT_URL (or POSTGRES_URL_NON_POOLING) to the session/direct connection on port 5432.`
      );
      return;
    }
    fail(
      `${resolved.source} points at port 6543 (transaction pooler), which cannot run migrations.`,
      "Set DIRECT_URL (or POSTGRES_URL_NON_POOLING) to the session/direct connection on port 5432. Keep the pooled URL on port 6543 as DATABASE_URL for runtime."
    );
  }

  const timeoutMs = Number(process.env.MIGRATE_TIMEOUT_MS ?? 120000);
  log("applying pending migrations (prisma migrate deploy)...");
  const { code, output } = await runMigrateDeploy(resolved.url, Number.isFinite(timeoutMs) ? timeoutMs : 120000);

  if (code === 124) {
    printFailureDiagnosis(output);
    fail(`migration run exceeded ${timeoutMs}ms.`, "Raise MIGRATE_TIMEOUT_MS or check for a lock held by another migration run.");
  }

  if (code !== 0) {
    printFailureDiagnosis(output);
    fail(
      "prisma migrate deploy failed.",
      "Fix the cause above, then redeploy - or run `npm run db:migrate` locally with DIRECT_URL set to the production session connection."
    );
  }

  log("database schema is up to date.");
}

main().catch((error) => {
  fail(`unexpected failure: ${error?.message ?? error}`, "Re-run the build; if it persists, run `npm run db:status` manually.");
});
