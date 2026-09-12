/**
 * Lease reaper: recovers expired leases by resetting status to pending
 * and recording lease_expired outcome.
 */

import { getPgPool } from "@/infrastructure/persistence/pg";

export interface LeaseReaperOptions {
  batchSize?: number;
}

export class PostgresLeaseReaper {
  private batchSize: number;

  constructor(options: LeaseReaperOptions = {}) {
    this.batchSize = options.batchSize ?? 10;
  }

  async reapExpiredLeases(): Promise<number> {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const selectQuery = `
        SELECT id, lease_owner, org_id, attempt_count
        FROM outbox_messages
        WHERE status = 'processing'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at <= NOW()
        ORDER BY lease_expires_at ASC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      `;

      const result = await client.query(selectQuery, [this.batchSize]);

      if (result.rows.length === 0) {
        await client.query("COMMIT");
        return 0;
      }

      let reaped = 0;
      const now = new Date();

      for (const row of result.rows) {
        // Update attempt row to lease_expired
        await client.query(
          `UPDATE outbox_attempts
           SET finished_at = $1, outcome = 'lease_expired', duration_ms = EXTRACT(EPOCH FROM ($1 - claimed_at)) * 1000
           WHERE outbox_id = $2 AND attempt_number = $3 AND finished_at IS NULL`,
          [now, row.id, row.attempt_count]
        );

        // Reset message to pending for retry, clear lease
        await client.query(
          `UPDATE outbox_messages
           SET status = 'pending',
               lease_owner = NULL,
               lease_expires_at = NULL,
               last_error_code = 'LEASE_EXPIRED',
               updated_at = $1
           WHERE id = $2`,
          [now, row.id]
        );

        reaped++;
      }

      await client.query("COMMIT");
      return reaped;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
