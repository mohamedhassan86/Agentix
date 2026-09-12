import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export function createPgPool(config?: PoolConfig): Pool {
  const connectionString = config?.connectionString ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to create pg Pool");
  }
  const poolConfig: PoolConfig = {
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
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
