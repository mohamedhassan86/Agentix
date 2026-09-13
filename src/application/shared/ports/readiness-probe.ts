export type ReadinessStatus = "ready" | "not_ready";
export type DependencyCategory = "database" | "schema";

/**
 * Closed set of machine-readable readiness failure reasons.
 * A reason is safe to expose in a Problem Details response: it never contains a
 * connection string, credential, host, or driver message.
 *
 * Grouped by dependency:
 * - database: the process cannot reach or authenticate to Postgres
 * - schema:   Postgres is reachable but the expected migration state is missing
 */
export type ReadinessReason =
  // dependency: database
  | "database_url_missing"
  | "connection_refused"
  | "connection_timeout"
  | "connection_failed"
  | "authentication_failed"
  | "database_missing"
  | "too_many_connections"
  | "server_unavailable"
  | "tls_handshake_failed"
  | "tls_verification_failed"
  // dependency: schema
  | "migration_table_missing"
  | "no_migrations_applied"
  | "foundation_migration_not_applied"
  | "migration_history_drift"
  // fallback
  | "unknown_database_error";

export interface ReadinessProbeResult {
  status: ReadinessStatus;
  dependency?: DependencyCategory;
  reason?: ReadinessReason;
  message?: string;
}

export interface IReadinessProbe {
  check(): Promise<ReadinessProbeResult>;
}

/**
 * Dependency implied by a reason. Used to keep Problem Details consistent:
 * a `schema` failure always means Postgres answered, a `database` failure never does.
 */
export function dependencyForReason(reason: ReadinessReason): DependencyCategory {
  switch (reason) {
    case "migration_table_missing":
    case "no_migrations_applied":
    case "foundation_migration_not_applied":
    case "migration_history_drift":
      return "schema";
    default:
      return "database";
  }
}

/**
 * Operator-facing remediation for a readiness failure.
 * Returned as Problem Details `detail`; contains no secret and no driver text.
 */
export function remediationForReason(reason: ReadinessReason): string {
  switch (reason) {
    case "database_url_missing":
      return "No database connection string is configured for this environment. Set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL) in the host environment and redeploy.";
    case "connection_refused":
      return "Postgres refused the connection. On Supabase use the transaction pooler URL (host *.pooler.supabase.com, port 6543) for DATABASE_URL at runtime.";
    case "connection_timeout":
      return "Postgres did not answer within 2s. Verify the database host, port, and that the host environment allows outbound TLS to Postgres.";
    case "connection_failed":
      return "The database connection failed. Verify DATABASE_URL, that sslmode is enabled, and that the host environment can reach Postgres.";
    case "authentication_failed":
      return "Postgres rejected the credentials or database role. Re-copy the connection string and its password from the database provider.";
    case "database_missing":
      return "The database named in the connection string does not exist on this server.";
    case "too_many_connections":
      return "Postgres refused a new connection because the pool is exhausted. Use the pooler URL for runtime and keep per-instance connections small.";
    case "server_unavailable":
      return "Postgres is reachable but shutting down or unavailable. Retry after the provider finishes maintenance.";
    case "tls_handshake_failed":
      return "The TLS handshake failed. Hosted Postgres requires TLS: add ?sslmode=require to DATABASE_URL, or set PG_SSL_MODE=require. Use PG_SSL_MODE=disable only for a local database.";
    case "tls_verification_failed":
      return "TLS is on but the server certificate could not be verified. Provide the provider CA with PG_SSL_CA, or use PG_SSL_MODE=require (encrypt without chain verification).";
    case "migration_table_missing":
      return "The database has no migration history (missing _prisma_migrations). Apply migrations with the direct (port 5432) connection: npm run db:migrate.";
    case "no_migrations_applied":
      return "The database is reachable but no migration was recorded. Apply migrations with the direct (port 5432) connection: npm run db:migrate.";
    case "foundation_migration_not_applied":
      return "Migration 001_solution_foundation has not been applied to this database. Run npm run db:migrate against the direct (port 5432) connection.";
    case "migration_history_drift":
      return "The foundation tables exist but the migration is not recorded in _prisma_migrations. Mark it applied with: npx prisma migrate resolve --applied 20250912000000_001_solution_foundation.";
    case "unknown_database_error":
    default:
      return "The database dependency is not ready. Check the deployment logs for the correlation id above, then retry.";
  }
}
