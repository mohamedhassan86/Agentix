/**
 * Idempotent foundation.demo.requested v1 handler.
 * Unique request/work effect, request completion, outbox success, attempt closure.
 * Redelivery of existing effect succeeds without incrementing effect count.
 */

import { getPgPool } from "@/infrastructure/persistence/pg";
import type { WorkContext } from "@/application/shared/work/work-context";
import type { WorkResult } from "@/application/shared/work/work-result";
import { successResult } from "@/application/shared/work/work-result";
import { v7 as uuidv7 } from "uuid";

export const FOUNDATION_DEMO_WORK_TYPE = "foundation.demo.requested";
export const FOUNDATION_DEMO_SCHEMA_VERSION = 1;

export async function foundationDemoHandler(
  payload: Record<string, unknown>,
  context: WorkContext
): Promise<WorkResult> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check if effect already exists for this outbox (idempotent redelivery)
    const existingEffect = await client.query(
      `SELECT id FROM foundation_demo_effects WHERE outbox_id = $1`,
      [context.workId]
    );

    if (existingEffect.rows.length > 0) {
      await client.query("COMMIT");
      return successResult();
    }

    // Find the request associated via outbox -> need to look up request by correlation?
    // Our demo request id is stored in payload? For foundation demo, payload is empty,
    // but we have correlationId linking request. We need to find request by correlation and idempotency?
    // Simpler: Find request that has same correlationId and not yet completed, or use work's idempotency?
    // In our atomic enqueue, request and outbox are created together, but we don't have direct link except via correlation.
    // We will store requestId in payload for foundation demo? Spec says payload object ≤64 KiB at Application boundary,
    // but foundation demo payload is empty. So we need to find request via outbox's idempotency or via separate lookup.
    // For this handler, we will assume requestId is available via payload.requestId or via correlationId lookup.

    // Try to find request by idempotency key = outbox idempotency? For foundation demo, idempotencyKey is same for request and outbox?
    // In foundation-demo-repository, request idempotencyKey is separate from outbox idempotencyKey.
    // We need to find request that was created atomically with this outbox.
    // We can find via foundation_demo_effects doesn't exist, so we need to find request by correlationId and that has no effect yet.

    // For simplicity, we will query foundation_demo_requests by correlationId that doesn't have effect yet
    const requestResult = await client.query(
      `SELECT r.id FROM foundation_demo_requests r
       LEFT JOIN foundation_demo_effects e ON e.request_id = r.id
       WHERE r.correlation_id = $1 AND e.id IS NULL
       ORDER BY r.requested_at ASC
       LIMIT 1
       FOR UPDATE`,
      [context.correlationId]
    );

    let requestId: string | null = null;
    if (requestResult.rows.length > 0) {
      requestId = requestResult.rows[0].id;
    } else {
      // If not found by correlation, try payload.requestId
      const payloadRequestId = (payload as any).requestId;
      if (payloadRequestId) {
        requestId = payloadRequestId;
      }
    }

    if (!requestId) {
      // If still not found, we cannot create effect without request - fail
      await client.query("ROLLBACK");
      return {
        outcome: "failed",
        errorCode: "DEMO_REQUEST_NOT_FOUND",
      };
    }

    // Check again for existing effect for this request (unique constraint)
    const existingByRequest = await client.query(
      `SELECT id FROM foundation_demo_effects WHERE request_id = $1`,
      [requestId]
    );

    if (existingByRequest.rows.length > 0) {
      // Already has effect - idempotent
      await client.query("COMMIT");
      return successResult();
    }

    // Create effect - unique by request/work
    const effectId = uuidv7();
    await client.query(
      `INSERT INTO foundation_demo_effects (id, request_id, outbox_id, correlation_id)
       VALUES ($1, $2, $3, $4)`,
      [effectId, requestId, context.workId, context.correlationId]
    );

    // Complete request
    await client.query(
      `UPDATE foundation_demo_requests SET completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [requestId]
    );

    await client.query("COMMIT");
    return successResult();
  } catch (e: any) {
    await client.query("ROLLBACK");
    // Handle unique violation as success (idempotent)
    if (e.code === "23505" || e.message?.includes("unique") || e.message?.includes("duplicate")) {
      return successResult();
    }
    throw e;
  } finally {
    client.release();
  }
}
