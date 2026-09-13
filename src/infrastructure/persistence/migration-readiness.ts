import type { IReadinessProbe, ReadinessProbeResult } from "@/application/shared/ports/readiness-probe";
import { createLogger } from "../observability/logger";
import { classifyConnectionError } from "./connection-error";
import { getPgPool, getPgPoolInfo } from "./pg";

/**
 * Readiness is intentionally bounded (default 2s) so a slow dependency cannot
 * stall the health endpoint. The *pool's* connect timeout is separate and much
 * longer (see DB_CONNECTION_TIMEOUT_MS) — cold-starting hosted Postgres is slow,
 * and readiness only needs to answer "is it up right now?".
 */
function readinessBudgetMs(): number {
  const raw = Number(process.env.DB_READINESS_TIMEOUT_MS ?? 2000);
  return Number.isFinite(raw) && raw >= 250 ? Math.trunc(raw) : 2000;
}

function logFailure(logger: ReturnType<typeof createLogger>, stage: string, error: unknown): void {
  const failure = classifyConnectionError(error);
  logger.warn({
    msg: "database readiness failed",
    stage,
    category: failure.category,
    code: failure.code,
    pool: getPgPoolInfo()?.source ?? "unknown",
    pooler: getPgPoolInfo()?.usesPooler ?? false,
  });
}

export class MigrationReadinessProbe implements IReadinessProbe {
  private expectedMigration = "001_solution_foundation";
  private logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });

  async check(): Promise<ReadinessProbeResult> {
    const pool = getPgPool();
    const budget = readinessBudgetMs();
    let client;
    try {
      client = await Promise.race([
        pool.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error("connect acquire timeout"), { code: "ACQUIRE_TIMEOUT" })), budget),
        ),
      ]);
    } catch (e) {
      logFailure(this.logger, "connect", e);
      const failure = classifyConnectionError(e);
      return { status: "not_ready", dependency: "database", message: failure.category };
    }

    try {
      // Liveness query with timeout
      await withBudget(client.query("SELECT 1"), budget);

      // Schema check: Prisma records applied migrations in _prisma_migrations
      try {
        const applied = await withBudget(
          client.query<{ migration_name: string }>(
            `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE $1 AND finished_at IS NOT NULL`,
            [`%${this.expectedMigration}%`],
          ),
          budget,
        );
        if (applied.rows.length === 0) {
          return {
            status: "not_ready",
            dependency: "schema",
            message: `foundation migration ${this.expectedMigration} not applied`,
          };
        }
      } catch (e) {
        const err = e as { code?: string };
        if (err.code === "42P01" || (e as Error).message?.includes("_prisma_migrations")) {
          return {
            status: "not_ready",
            dependency: "schema",
            message: "migrations not applied: run prisma migrate deploy with the non-pooled URL",
          };
        }
        throw e;
      }

      return { status: "ready" };
    } catch (e) {
      logFailure(this.logger, "query", e);
      const failure = classifyConnectionError(e);
      return { status: "not_ready", dependency: "database", message: failure.category };
    } finally {
      client.release();
    }
  }
}

async function withBudget<T>(promise: Promise<T>, budgetMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(Object.assign(new Error("query timeout"), { code: "QUERY_TIMEOUT" })),
          budgetMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class DatabaseReadinessProbe implements IReadinessProbe {
  private logger = createLogger({ level: process.env.LOG_LEVEL ?? "info" });

  async check(): Promise<ReadinessProbeResult> {
    const pool = getPgPool();
    const budget = readinessBudgetMs();
    let client;
    try {
      client = await Promise.race([
        pool.connect(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(Object.assign(new Error("connect acquire timeout"), { code: "ACQUIRE_TIMEOUT" })), budget),
        ),
      ]);
    } catch (e) {
      logFailure(this.logger, "connect", e);
      return { status: "not_ready", dependency: "database", message: classifyConnectionError(e).category };
    }
    try {
      await withBudget(client.query("SELECT 1"), budget);
      return { status: "ready" };
    } catch (e) {
      logFailure(this.logger, "query", e);
      return { status: "not_ready", dependency: "database", message: classifyConnectionError(e).category };
    } finally {
      client.release();
    }
  }
}
