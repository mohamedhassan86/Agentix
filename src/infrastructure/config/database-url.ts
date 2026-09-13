import { readFileSync } from "node:fs";

/**
 * Single source of truth for resolving the Postgres connection string.
 *
 * Hosts inject different names for the same secret:
 * - DATABASE_URL                      - this project's canonical name (.env.example, local dev)
 * - POSTGRES_PRISMA_URL               - Supabase <-> Vercel integration, pooled (runtime)
 * - POSTGRES_URL                      - Supabase <-> Vercel integration, pooled (runtime)
 * - SUPABASE_DB_URL                   - Supabase CLI / local stack
 * - DIRECT_URL                        - explicit direct/migration connection
 * - POSTGRES_URL_NON_POOLING          - Supabase <-> Vercel integration, direct (migrations)
 *
 * Runtime (serverless) prefers a pooled connection; migrations require a direct or
 * session connection because `prisma migrate deploy` needs session-scoped statements.
 * Values are never logged: only the *name* of the variable a value came from.
 */

export type DatabaseUrlPurpose = "runtime" | "migration";

export const RUNTIME_DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
] as const;

export const MIGRATION_DATABASE_URL_KEYS = [
  "DIRECT_URL",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DB_URL",
] as const;

export interface ResolvedDatabaseUrl {
  url: string;
  /** Name of the environment variable the value came from (never the value). */
  source: string;
}

function firstNonEmpty(env: NodeJS.ProcessEnv, keys: readonly string[]): ResolvedDatabaseUrl | null {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return { url: value.trim(), source: key };
    }
  }
  return null;
}

export function resolveRuntimeDatabaseUrl(env: NodeJS.ProcessEnv = process.env): ResolvedDatabaseUrl | null {
  return firstNonEmpty(env, RUNTIME_DATABASE_URL_KEYS);
}

export function resolveMigrationDatabaseUrl(env: NodeJS.ProcessEnv = process.env): ResolvedDatabaseUrl | null {
  return firstNonEmpty(env, MIGRATION_DATABASE_URL_KEYS);
}

export function resolveDatabaseUrl(purpose: DatabaseUrlPurpose, env: NodeJS.ProcessEnv = process.env): ResolvedDatabaseUrl | null {
  return purpose === "migration" ? resolveMigrationDatabaseUrl(env) : resolveRuntimeDatabaseUrl(env);
}

export interface ConnectionTarget {
  host: string;
  port: string;
  database?: string;
  /** True when the host/port looks like a transaction-mode pooler (Supabase port 6543). */
  transactionPooler: boolean;
}

/**
 * Safe, credential-free description of a connection target for diagnostics.
 * Never returns user, password, or query parameters.
 */
export function describeConnectionTarget(url: string): ConnectionTarget | null {
  try {
    const parsed = new URL(url);
    const port = parsed.port || "5432";
    return {
      host: parsed.hostname,
      port,
      database: parsed.pathname.replace(/^\//, "") || undefined,
      transactionPooler: port === "6543",
    };
  } catch {
    return null;
  }
}

/** True when the value looks like a Postgres connection string (used for validation only). */
export function isPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//i.test(url);
}

export type SslMode = "disable" | "require" | "verify-ca" | "verify-full";

/** Hosts where TLS is neither expected nor usually available (local docker Postgres). */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal"]);

export function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return LOCAL_HOSTNAMES.has(host) || host.endsWith(".local") || host.endsWith(".internal");
}

export interface SslResolution {
  /** Connection string with SSL parameters removed - the explicit `ssl` value governs. */
  connectionString: string;
  ssl: false | { rejectUnauthorized: boolean; ca?: string };
  mode: SslMode;
  source: "env" | "url" | "default";
}

/**
 * Decide how the driver must secure the connection.
 *
 * `pg` does **not** default to TLS: without `sslmode` (or `ssl`) in the connection string it
 * connects in plaintext, and hosted Postgres (Supabase, Neon, RDS) drops that handshake with
 * "Connection terminated unexpectedly" and no error code. Prisma does default to TLS for remote
 * hosts, which is why migrations can succeed while the runtime pool fails.
 *
 * Precedence: PG_SSL_MODE (deployment override) > URL `sslmode` > default.
 * Default: TLS required for remote hosts (libpq `require` semantics: encrypt, do not verify the
 * chain), disabled for local hosts. Use `verify-ca`/`verify-full` (with PG_SSL_CA) to verify.
 */
export function resolveDatabaseSsl(connectionString: string, env: NodeJS.ProcessEnv = process.env): SslResolution {
  const withoutSslParams = (): { url: string; hostname: string } => {
    const parsed = new URL(connectionString);
    for (const key of ["sslmode", "ssl", "uselibpqcompat", "sslrootcert", "sslcert", "sslkey"]) {
      parsed.searchParams.delete(key);
    }
    return { url: parsed.toString(), hostname: parsed.hostname };
  };

  let url: string;
  let hostname: string;
  try {
    const stripped = withoutSslParams();
    url = stripped.url;
    hostname = stripped.hostname;
  } catch {
    // Unparseable URL: leave it untouched and let the driver report the failure.
    return { connectionString, ssl: false, mode: "disable", source: "default" };
  }

  let urlMode: SslMode | undefined;
  try {
    const raw = new URL(connectionString).searchParams.get("sslmode")?.toLowerCase();
    if (raw === "disable" || raw === "require" || raw === "verify-ca" || raw === "verify-full") urlMode = raw;
    else if (raw === "prefer" || raw === "allow" || raw === "no-verify") urlMode = "require";
  } catch {
    urlMode = undefined;
  }

  const envModeRaw = env.PG_SSL_MODE?.trim().toLowerCase();
  const envMode = envModeRaw === "disable" || envModeRaw === "require" || envModeRaw === "verify-ca" || envModeRaw === "verify-full" ? envModeRaw : undefined;

  const mode: SslMode = envMode ?? urlMode ?? (isLocalHostname(hostname) ? "disable" : "require");
  const source: SslResolution["source"] = envMode ? "env" : urlMode ? "url" : "default";

  if (mode === "disable") {
    return { connectionString: url, ssl: false, mode, source };
  }

  const caPath = env.PG_SSL_CA;
  const ca = caPath ? readFileSafe(caPath) : undefined;
  const verify = mode === "verify-ca" || mode === "verify-full";
  return {
    connectionString: url,
    ssl: ca ? { rejectUnauthorized: verify, ca } : { rejectUnauthorized: verify },
    mode,
    source,
  };
}

function readFileSafe(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return undefined;
  }
}
