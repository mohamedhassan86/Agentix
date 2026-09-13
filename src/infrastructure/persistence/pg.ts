import { Pool, type PoolConfig } from "pg";
import { RUNTIME_DATABASE_URL_KEYS, resolveRuntimeDatabaseUrl } from "@/infrastructure/config/database-url";

let pool: Pool | null = null;

function defaultPoolMax(): number {
  const raw = process.env.PG_POOL_MAX;
  const parsed = raw ? Number(raw) : NaN;
  // Small per-instance pools: serverless instances must not exhaust the provider pool.
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 50 ? parsed : 10;
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
  const poolConfig: PoolConfig = {
    connectionString,
    max: defaultPoolMax(),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    application_name: "agentix-web",
    ...config,
  };
  return new Pool(poolConfig);
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
