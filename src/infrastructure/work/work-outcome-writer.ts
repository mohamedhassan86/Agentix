/**
 * Work outcome writer: persists attempt outcome and updates outbox message status.
 */

import { getPgPool } from "@/infrastructure/persistence/pg";
import type { WorkResult } from "@/application/shared/work/work-result";

export class WorkOutcomeWriter {
  async writeOutcome(params: {
    workId: string;
    attemptNumber: number;
    result: WorkResult;
    workerId: string;
  }): Promise<void> {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const now = new Date();
      const { workId, attemptNumber, result } = params;

      // Update attempt row
      await client.query(
        `UPDATE outbox_attempts
         SET finished_at = $1,
             outcome = $2,
             error_code = $3,
             next_available_at = $4,
             duration_ms = $5
         WHERE outbox_id = $6 AND attempt_number = $7`,
        [
          now,
          result.outcome,
          result.errorCode ?? null,
          result.nextAvailableAt ?? null,
          result.durationMs ?? null,
          workId,
          attemptNumber,
        ]
      );

      // Update outbox message based on outcome
      if (result.outcome === "succeeded") {
        await client.query(
          `UPDATE outbox_messages
           SET status = 'succeeded',
               completed_at = $1,
               lease_owner = NULL,
               lease_expires_at = NULL,
               last_error_code = NULL,
               updated_at = $1
           WHERE id = $2`,
          [now, workId]
        );
      } else if (result.outcome === "retry_scheduled") {
        const nextAvailable = result.nextAvailableAt ?? new Date(Date.now() + 1000);
        await client.query(
          `UPDATE outbox_messages
           SET status = 'pending',
               available_at = $1,
               lease_owner = NULL,
               lease_expires_at = NULL,
               last_error_code = $2,
               updated_at = $3
           WHERE id = $4`,
          [nextAvailable, result.errorCode ?? null, now, workId]
        );
      } else if (result.outcome === "failed") {
        await client.query(
          `UPDATE outbox_messages
           SET status = 'failed',
               completed_at = $1,
               lease_owner = NULL,
               lease_expires_at = NULL,
               last_error_code = $2,
               updated_at = $1
           WHERE id = $3`,
          [now, result.errorCode ?? null, workId]
        );
      } else if (result.outcome === "cancelled" || result.outcome === "lease_expired") {
        await client.query(
          `UPDATE outbox_messages
           SET status = 'pending',
               lease_owner = NULL,
               lease_expires_at = NULL,
               last_error_code = $1,
               updated_at = $2
           WHERE id = $3`,
          [result.errorCode ?? result.outcome.toUpperCase(), now, workId]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
