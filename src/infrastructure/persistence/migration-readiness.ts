import type { IReadinessProbe, ReadinessProbeResult, ReadinessReason } from "@/application/shared/ports/readiness-probe";
import { getPgPool } from "./pg";
import { resolveRuntimeDatabaseUrl } from "@/infrastructure/config/database-url";
import { classifyDatabaseFailure } from "./db-diagnostics";

/** Bounded probe budget: every query races this timeout so readiness never hangs a request. */
export const PROBE_TIMEOUT_MS = 2000;

const EXPECTED_MIGRATION = "001_solution_foundation";
const MIGRATION_TABLE = "_prisma_migrations";

interface QueryableClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

interface ProbeDependencies {
  getPool?: () => { connect(): Promise<QueryableClient> };
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, reason: ReadinessReason = "connection_timeout"): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("probe timeout"), { code: reason, isProbeTimeout: true })), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Readiness probe for the database + schema dependency.
 *
 * It answers three questions in one bounded round trip and reports a closed-set
 * `reason`, so a failing deployment is diagnosable from the HTTP response alone:
 *   1. can this process open a connection? (dependency: database)
 *   2. is the migration history table present? (dependency: schema)
 *   3. is the foundation migration applied? (dependency: schema)
 */
export class MigrationReadinessProbe implements IReadinessProbe {
  private expectedMigration = EXPECTED_MIGRATION;
  private readonly deps: ProbeDependencies;
  private readonly timeoutMs: number;

  constructor(deps: ProbeDependencies = {}) {
    this.deps = deps;
    this.timeoutMs = deps.timeoutMs ?? PROBE_TIMEOUT_MS;
  }

  async check(): Promise<ReadinessProbeResult> {
    const env = this.deps.env ?? process.env;
    const resolved = resolveRuntimeDatabaseUrl(env);
    if (!resolved) {
      return {
        status: "not_ready",
        dependency: "database",
        reason: "database_url_missing",
        message: "No database connection string is configured",
      };
    }

    let client: QueryableClient | null = null;
    try {
      const pool = (this.deps.getPool ?? getPgPool)();
      client = await withTimeout(pool.connect(), this.timeoutMs);

      // 1. Connectivity (bounded)
      await withTimeout(client.query("SELECT 1"), this.timeoutMs);

      // 2. Schema readiness: migration history table + expected migration
      const migrationTable = await withTimeout(
        client.query("SELECT to_regclass($1) AS present", [`public.${MIGRATION_TABLE}`]),
        this.timeoutMs
      );
      if (!migrationTable.rows[0]?.present) {
        return { status: "not_ready", dependency: "schema", reason: "migration_table_missing", message: "Migration table missing" };
      }

      const applied = await withTimeout(
        client.query(`SELECT migration_name FROM "${MIGRATION_TABLE}" WHERE finished_at IS NOT NULL`),
        this.timeoutMs
      );
      if (applied.rows.length === 0) {
        return { status: "not_ready", dependency: "schema", reason: "no_migrations_applied", message: "No migrations applied" };
      }

      const expected = applied.rows.some((row) => String(row.migration_name ?? "").includes(this.expectedMigration));
      if (!expected) {
        // The migration is not recorded - but if the foundation tables exist the
        // database was migrated outside of Prisma's history (drifted, not empty).
        const tables = await withTimeout(
          client.query("SELECT to_regclass($1) AS present", ["public.outbox_messages"]),
          this.timeoutMs
        );
        return {
          status: "not_ready",
          dependency: "schema",
          reason: tables.rows[0]?.present ? "migration_history_drift" : "foundation_migration_not_applied",
          message: "Foundation migration not applied",
        };
      }

      return { status: "ready" };
    } catch (error) {
      const timeout = (error as { isProbeTimeout?: boolean }).isProbeTimeout === true;
      const classified = classifyDatabaseFailure(error);
      if (classified) {
        return { status: "not_ready", dependency: classified.dependency, reason: classified.reason, message: "Database dependency unavailable" };
      }
      if (timeout) {
        return { status: "not_ready", dependency: "database", reason: "connection_timeout", message: "Database probe timed out" };
      }
      // Unclassified driver/socket failure: still a database dependency failure,
      // reported with a closed-set reason so no driver text or credential leaks.
      return { status: "not_ready", dependency: "database", reason: "connection_failed", message: "Database unavailable" };
    } finally {
      try {
        client?.release();
      } catch {
        void 0;
      }
    }
  }
}

export class DatabaseReadinessProbe implements IReadinessProbe {
  private readonly deps: ProbeDependencies;
  private readonly timeoutMs: number;

  constructor(deps: ProbeDependencies = {}) {
    this.deps = deps;
    this.timeoutMs = deps.timeoutMs ?? PROBE_TIMEOUT_MS;
  }

  async check(): Promise<ReadinessProbeResult> {
    const env = this.deps.env ?? process.env;
    if (!resolveRuntimeDatabaseUrl(env)) {
      return { status: "not_ready", dependency: "database", reason: "database_url_missing", message: "No database connection string is configured" };
    }

    let client: QueryableClient | null = null;
    try {
      const pool = (this.deps.getPool ?? getPgPool)();
      client = await withTimeout(pool.connect(), this.timeoutMs);
      await withTimeout(client.query("SELECT 1"), this.timeoutMs);
      return { status: "ready" };
    } catch (error) {
      const classified = classifyDatabaseFailure(error);
      if (classified) {
        return { status: "not_ready", dependency: "database", reason: classified.reason, message: "Database unavailable" };
      }
      if ((error as { isProbeTimeout?: boolean }).isProbeTimeout === true) {
        return { status: "not_ready", dependency: "database", reason: "connection_timeout", message: "Database probe timed out" };
      }
      return { status: "not_ready", dependency: "database", reason: "connection_failed", message: "Database unavailable" };
    } finally {
      try {
        client?.release();
      } catch {
        void 0;
      }
    }
  }
}
