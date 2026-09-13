import { Pool, type PoolConfig } from "pg";
import { RUNTIME_DATABASE_URL_KEYS, resolveDatabaseSsl, resolveRuntimeDatabaseUrl } from "@/infrastructure/config/database-url";

let pool: Pool | null = null;

function positiveInt(value: string | undefined, fallback: number, min = 1, max = 60000): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function defaultPoolMax(): number {
  // Small per-instance pools: serverless instances must not exhaust the provider pool.
  return positiveInt(process.env.PG_POOL_MAX, 10, 1, 50);
}

export function createPgPool(config?: PoolConfig): Pool {
  // Accepts DATABASE_URL or the names injected by the Supabase <-> Vercel integration.
  const resolved = resolveRuntimeDatabaseUrl();
  const connectionString = config?.connectionString ?? resolved?.url;
  if (!connectionString) {
    throw new Error(
      `No Postgres connection string configured. Accepted variables: ${RUNTIME_DATABASE_URL_KEYS.join(", ")}. Remediation: set DATABASE_URL in the host environment.`
    );
  }

  // Hosted Postgres requires TLS and `pg` does not default to it: without this the driver
  // connects in plaintext and the server drops the socket with no error code
  // ("Connection terminated unexpectedly"), which is undiagnosable from the outside.
  const sslResolution = resolveDatabaseSsl(connectionString);

  const poolConfig: PoolConfig = {
    connectionString: sslResolution.connectionString,
    ssl: sslResolution.ssl,
    max: defaultPoolMax(),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: positiveInt(process.env.PG_CONNECT_TIMEOUT_MS, 2000, 200, 30000),
    application_name: "agentix-web",
    ...config,
  };
  return new Pool(poolConfig);
}

/** Credential-free description of how the runtime pool is secured (for logs and diagnostics). */
export function describePgPoolSecurity(): { source: string; sslMode: string; sslSource: string } | null {
  const resolved = resolveRuntimeDatabaseUrl();
  if (!resolved) return null;
  const ssl = resolveDatabaseSsl(resolved.url);
  return { source: resolved.source, sslMode: ssl.mode, sslSource: ssl.source };
}

export function getPgPool(): Pool {
  if (!pool) {
    pool = createPgPool();
  }
  return pool;
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
