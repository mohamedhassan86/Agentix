import type { IReadinessProbe, ReadinessProbeResult } from "@/application/shared/ports/readiness-probe";
import { getPgPool } from "./pg";

export class MigrationReadinessProbe implements IReadinessProbe {
  private expectedMigration = "001_solution_foundation";

  async check(): Promise<ReadinessProbeResult> {
    const pool = getPgPool();
    try {
      // Check database connectivity with bounded query
      const client = await pool.connect();
      try {
        // Simple liveness query with timeout
        await client.query("SELECT 1");
      } finally {
        client.release();
      }

      // Check if migration table exists and contains expected migration
      const client2 = await pool.connect();
      try {
        // Prisma uses _prisma_migrations table
        const result = await client2.query(
          `SELECT id FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`
        );
        // If table doesn't exist, it will throw, caught below
        if (result.rows.length === 0) {
          return { status: "not_ready", dependency: "schema", message: "No migrations applied" };
        }
        // Check if our migration exists
        const check = await client2.query(
          `SELECT migration_name FROM "_prisma_migrations" WHERE migration_name LIKE $1 AND finished_at IS NOT NULL`,
          [`%${this.expectedMigration}%`]
        );
        if (check.rows.length === 0) {
          return { status: "not_ready", dependency: "schema", message: "Foundation migration not applied" };
        }
        return { status: "ready" };
      } catch (e: any) {
        // If _prisma_migrations doesn't exist, schema not ready
        if (e.message?.includes("_prisma_migrations") || e.code === "42P01") {
          return { status: "not_ready", dependency: "schema", message: "Migration table missing" };
        }
        throw e;
      } finally {
        client2.release();
      }
    } catch {
      return { status: "not_ready", dependency: "database", message: "Database unavailable" };
    }
  }
}

export class DatabaseReadinessProbe implements IReadinessProbe {
  async check(): Promise<ReadinessProbeResult> {
    const pool = getPgPool();
    try {
      const client = await pool.connect();
      try {
        await Promise.race([
          client.query("SELECT 1"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
        ]);
        return { status: "ready" };
      } finally {
        client.release();
      }
    } catch {
      return { status: "not_ready", dependency: "database", message: "Database unavailable" };
    }
  }
}
