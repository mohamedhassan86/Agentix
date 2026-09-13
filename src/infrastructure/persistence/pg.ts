import { Pool, type PoolConfig } from "pg";
import { poolTuning, redactConnectionString, resolveDatabaseUrls } from "../config/database-url";

export interface PgPoolInfo {
  /** Env var the connection string was read from (name only, never the value). */
  source: string;
  /** True when talking to a PgBouncer-style transaction pooler. */
  usesPooler: boolean;
  /** Credential-free connection string, safe to log. */
  redacted: string;
  max: number;
  connectionTimeoutMillis: number;
}

let pool: Pool | null = null;
let poolInfo: PgPoolInfo | null = null;

function buildPoolConfig(config?: PoolConfig): { poolConfig: PoolConfig; info: PgPoolInfo } {
  const resolved = resolveDatabaseUrls();
  const connectionString = config?.connectionString ?? resolved.appUrl;
  const tuning = poolTuning(resolved.usesPooler);

  const poolConfig: PoolConfig = {
    connectionString,
    max: tuning.max,
    idleTimeoutMillis: tuning.idleTimeoutMillis,
    connectionTimeoutMillis: tuning.connectionTimeoutMillis,
    ...(tuning.statementTimeoutMs ? { statement_timeout: tuning.statementTimeoutMs } : {}),
    ...config,
  };

  const info: PgPoolInfo = {
    source: resolved.appUrlSource,
    usesPooler: resolved.usesPooler,
    redacted: redactConnectionString(connectionString),
    max: (poolConfig.max as number) ?? tuning.max,
    connectionTimeoutMillis:
      (poolConfig.connectionTimeoutMillis as number) ?? tuning.connectionTimeoutMillis,
  };

  return { poolConfig, info };
}

/** Describe the active pool without exposing credentials. */
export function getPgPoolInfo(): PgPoolInfo | null {
  return poolInfo;
}

export function createPgPool(config?: PoolConfig): Pool {
  const { poolConfig, info } = buildPoolConfig(config);
  poolInfo = info;
  return new Pool(poolConfig);
}

export function getPgPool(): Pool {
  if (!pool) {
    pool = createPgPool();
  }
  return pool;
}

/**
 * One bounded connection check that reports *why* a connection failed.
 * The readiness probes used to collapse every failure into "Database unavailable",
 * which made a Vercel env-var / TLS / pooler misconfiguration indistinguishable
 * from a real outage. `detail` never contains the connection string.
 */
export interface ConnectionCheckResult {
  ok: boolean;
  elapsedMs: number;
  source: string;
  redacted: string;
  usesPooler: boolean;
  code?: string;
  detail?: string;
}

export async function checkDatabaseConnection(): Promise<ConnectionCheckResult> {
  const start = Date.now();
  let probe: Pool | null = null;
  let info: PgPoolInfo | null = null;
  try {
    const built = buildPoolConfig();
    info = built.info;
    probe = new Pool(built.poolConfig);
    const client = await probe.connect();
    try {
      const res = await client.query("SELECT 1 AS ok, current_schema() AS schema_name");
      return {
        ok: res.rows[0]?.ok === 1,
        elapsedMs: Date.now() - start,
        source: info.source,
        redacted: info.redacted,
        usesPooler: info.usesPooler,
        detail: `schema=${res.rows[0]?.schema_name ?? "?"}`,
      };
    } finally {
      client.release();
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    return {
      ok: false,
      elapsedMs: Date.now() - start,
      source: info?.source ?? "unknown",
      redacted: info?.redacted ?? "",
      usesPooler: info?.usesPooler ?? false,
      code: err.code ?? "UNKNOWN",
      detail: `${err.name}: ${err.message}`.slice(0, 300),
    };
  } finally {
    if (probe) await probe.end().catch(() => undefined);
  }
}

export async function closePgPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    poolInfo = null;
  }
}
