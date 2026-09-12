/**
 * Postgres work claimer using FOR UPDATE SKIP LOCKED.
 * Short-transaction batch claim, indexed, processing lease ownership.
 */

import { getPgPool } from "@/infrastructure/persistence/pg";

export interface ClaimedWork {
  workId: string;
  type: string;
  schemaVersion: number;
  scope: "global" | "tenant";
  orgId: string | null;
  correlationId: string;
  traceParent: string | null;
  traceState: string | null;
  payload: Record<string, unknown>;
  attemptNumber: number;
  maxAttempts: number;
  attemptId: string;
}

export interface WorkClaimerOptions {
  batchSize?: number;
  leaseDurationMs?: number;
  workerId: string;
}

export class PostgresWorkClaimer {
  private batchSize: number;
  private leaseDurationMs: number;
  private workerId: string;

  constructor(options: WorkClaimerOptions) {
    this.batchSize = options.batchSize ?? 10;
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.workerId = options.workerId;
  }

  async claimBatch(): Promise<ClaimedWork[]> {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Select available work with SKIP LOCKED, ordered by available_at, created_at, id
      // Only pending or retry_scheduled that are due, and not leased or lease expired
      const selectQuery = `
        SELECT id, work_type, schema_version, scope, org_id, correlation_id, trace_parent, trace_state, payload, attempt_count, max_attempts
        FROM outbox_messages
        WHERE status IN ('pending', 'processing')
          AND available_at <= NOW()
          AND (lease_expires_at IS NULL OR lease_expires_at <= NOW())
          AND attempt_count < max_attempts
        ORDER BY available_at ASC, created_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await client.query(selectQuery, [this.batchSize]);

      if (result.rows.length === 0) {
        await client.query("COMMIT");
        return [];
      }

      const claimed: ClaimedWork[] = [];
      const now = new Date();
      const leaseExpiresAt = new Date(now.getTime() + this.leaseDurationMs);

      for (const row of result.rows) {
        const attemptNumber = row.attempt_count + 1;
        const { v7: uuidv7 } = await import("uuid");
        const attemptId = uuidv7();

        // Insert attempt row
        await client.query(
          `INSERT INTO outbox_attempts (id, outbox_id, org_id, attempt_number, worker_id, claimed_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [attemptId, row.id, row.org_id, attemptNumber, this.workerId, now]
        );

        // Update outbox message to processing with lease
        await client.query(
          `UPDATE outbox_messages
           SET status = 'processing',
               attempt_count = $1,
               lease_owner = $2,
               lease_expires_at = $3,
               started_at = COALESCE(started_at, $4),
               updated_at = $4
           WHERE id = $5`,
          [attemptNumber, this.workerId, leaseExpiresAt, now, row.id]
        );

        claimed.push({
          workId: row.id,
          type: row.work_type,
          schemaVersion: row.schema_version,
          scope: row.scope,
          orgId: row.org_id,
          correlationId: row.correlation_id,
          traceParent: row.trace_parent,
          traceState: row.trace_state,
          payload: row.payload,
          attemptNumber,
          maxAttempts: row.max_attempts,
          attemptId,
        });
      }

      await client.query("COMMIT");
      return claimed;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
