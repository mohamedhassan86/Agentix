import type { IReadinessProbe, ReadinessProbeResult, ReadinessReason } from "@/application/shared/ports/readiness-probe";
import { getPgPool } from "./pg";
import { describeConnectionTarget, resolveRuntimeDatabaseUrl } from "@/infrastructure/config/database-url";
import { classifyDatabaseFailure } from "./db-diagnostics";
import { getLogger } from "@/infrastructure/observability/logger";

/** Bounded probe budget: every query races this timeout so readiness never hangs a request. */
export const PROBE_TIMEOUT_MS = 2000;

const EXPECTED_MIGRATION = "001_solution_foundation";
const MIGRATION_TABLE = "_prisma_migrations";

interface QueryableClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

interface ConnectionTargetForLog {
  /** Name of the environment variable the connection string came from. */
  source: string;
  target: ReturnType<typeof describeConnectionTarget>;
}

/**
 * Driver codes are safe to log (SQLSTATE, errno, Prisma code) and turn an opaque
 * "connection_failed" into an actionable line in the host's logs. Error *messages* are never
 * logged: they can embed the host, the role, or the whole connection string.
 */
function unclassifiedDriverCode(error: unknown): string {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string" && code.length <= 40) return code;
  const name = (error as { name?: unknown })?.name;
  if (typeof name === "string" && name.length <= 40) return name;
  return "unclassified";
}

/** True when the foundation tables exist (schema present, regardless of migration history). */
async function hasFoundationTables(client: QueryableClient, timeoutMs: number): Promise<boolean> {
  const tables = await withTimeout(
    client.query("SELECT to_regclass($1) AS present", ["public.outbox_messages"]),
    timeoutMs
  );
  return Boolean(tables.rows[0]?.present);
}

function logProbeFailure(reason: string, dependency: string, driverCode?: string, targetSource?: ConnectionTargetForLog): void {
  try {
    getLogger().warn({
      operation: "readinessProbe",
      reason,
      dependency,
      driverCode: driverCode ?? "unclassified",
      // Credential-free: host, port, database and the *name* of the variable they came from.
      // This is what lets an operator compare the database the app reached with the one the
      // build migrated ("migrated X, probing Y").
      databaseHost: targetSource?.target?.host,
      databasePort: targetSource?.target?.port,
      databaseName: targetSource?.target?.database,
      // NOTE: not named *databaseUrl* - the logger redacts keys containing "databaseurl",
      // which would silently drop the most useful field in this line.
      urlVariableName: targetSource?.source,
    });
  } catch {
    void 0;
  }
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

    const logTarget: ConnectionTargetForLog = { source: resolved.source, target: describeConnectionTarget(resolved.url) };

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
        // No history table. Two very different situations share this symptom, and the operator
        // must be told which one: an empty database (`migrate deploy` applies the schema) versus
        // a schema created outside Prisma's history, e.g. `db push` or a hand-run migration.sql
        // (`migrate deploy` would fail with P3005 - the fix is `migrate resolve --applied`).
        const existingSchema = await hasFoundationTables(client, this.timeoutMs);
        return existingSchema
          ? { status: "not_ready", dependency: "schema", reason: "migration_history_drift", message: "Schema present without migration history" }
          : { status: "not_ready", dependency: "schema", reason: "migration_table_missing", message: "Migration table missing" };
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
        return {
          status: "not_ready",
          dependency: "schema",
          reason: (await hasFoundationTables(client, this.timeoutMs)) ? "migration_history_drift" : "foundation_migration_not_applied",
          message: "Foundation migration not applied",
        };
      }

      return { status: "ready" };
    } catch (error) {
      const timeout = (error as { isProbeTimeout?: boolean }).isProbeTimeout === true;
      const classified = classifyDatabaseFailure(error);
      if (classified) {
        logProbeFailure(classified.reason, classified.dependency, classified.driverCode, logTarget);
        return { status: "not_ready", dependency: classified.dependency, reason: classified.reason, message: "Database dependency unavailable" };
      }
      if (timeout) {
        logProbeFailure("connection_timeout", "database", "probe_timeout", logTarget);
        return { status: "not_ready", dependency: "database", reason: "connection_timeout", message: "Database probe timed out" };
      }
      // Unclassified driver/socket failure: still a database dependency failure,
      // reported with a closed-set reason so no driver text or credential leaks.
      logProbeFailure("connection_failed", "database", unclassifiedDriverCode(error), logTarget);
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
    const resolved = resolveRuntimeDatabaseUrl(env);
    if (!resolved) {
      return { status: "not_ready", dependency: "database", reason: "database_url_missing", message: "No database connection string is configured" };
    }

    const logTarget: ConnectionTargetForLog = resolved
      ? { source: resolved.source, target: describeConnectionTarget(resolved.url) }
      : { source: "none", target: null };

    let client: QueryableClient | null = null;
    try {
      const pool = (this.deps.getPool ?? getPgPool)();
      client = await withTimeout(pool.connect(), this.timeoutMs);
      await withTimeout(client.query("SELECT 1"), this.timeoutMs);
      return { status: "ready" };
    } catch (error) {
      const classified = classifyDatabaseFailure(error);
      if (classified) {
        logProbeFailure(classified.reason, "database", classified.driverCode, logTarget);
        return { status: "not_ready", dependency: "database", reason: classified.reason, message: "Database unavailable" };
      }
      if ((error as { isProbeTimeout?: boolean }).isProbeTimeout === true) {
        logProbeFailure("connection_timeout", "database", "probe_timeout", logTarget);
        return { status: "not_ready", dependency: "database", reason: "connection_timeout", message: "Database probe timed out" };
      }
      logProbeFailure("connection_failed", "database", unclassifiedDriverCode(error), logTarget);
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
