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
