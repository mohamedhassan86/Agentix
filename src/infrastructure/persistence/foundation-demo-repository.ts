import type { PrismaClient } from "../../generated/prisma/client";
import type { WorkEnvelope } from "@/application/shared/work/work-envelope";
import type { IFoundationDemoRepository, FoundationDemoRequest, OutboxMessageRef, FoundationDemoEffect } from "@/application/shared/ports/foundation-demo-repository";
import { getPgPool } from "./pg";

export interface FoundationDemoRequestRecord {
  id: string;
  idempotencyKey: string;
  correlationId: string;
  requestedAt: Date;
  completedAt: Date | null;
}

export interface FoundationDemoEffectRecord {
  id: string;
  requestId: string;
  outboxId: string;
  correlationId: string;
  appliedAt: Date;
}

export class FoundationDemoRepository implements IFoundationDemoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createRequestWithOutboxAtomic(params: {
    requestId: string;
    idempotencyKey: string;
    correlationId: string;
    envelope: WorkEnvelope;
  }): Promise<{ request: FoundationDemoRequestRecord; workId: string; isNew: boolean }> {
    const existingRequest = (await (this.prisma.foundationDemoRequest as any).findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    })) as any;

    if (existingRequest) {
      const effect = (await (this.prisma.foundationDemoEffect as any).findUnique({
        where: { requestId: existingRequest.id },
      })) as any;
      return {
        request: {
          id: existingRequest.id,
          idempotencyKey: existingRequest.idempotencyKey,
          correlationId: existingRequest.correlationId,
          requestedAt: existingRequest.requestedAt,
          completedAt: existingRequest.completedAt,
        },
        workId: effect?.outboxId ?? "",
        isNew: false,
      };
    }

    const result = await (this.prisma as any).$transaction(async (tx: any) => {
      const request = await tx.foundationDemoRequest.create({
        data: {
          id: params.requestId,
          idempotencyKey: params.idempotencyKey,
          correlationId: params.correlationId,
        },
      });

      const outbox = await tx.outboxMessage.create({
        data: {
          id: params.envelope.workId,
          workType: params.envelope.type,
          schemaVersion: params.envelope.schemaVersion,
          scope: params.envelope.scope as any,
          orgId: params.envelope.orgId,
          idempotencyKey: params.envelope.idempotencyKey,
          correlationId: params.envelope.correlationId,
          traceParent: params.envelope.traceParent ?? null,
          traceState: params.envelope.traceState ?? null,
          payload: params.envelope.payload as any,
          status: "pending",
          availableAt: params.envelope.availableAt,
          maxAttempts: params.envelope.maxAttempts,
          attemptCount: 0,
        },
      });

      return { request, outbox };
    });

    return {
      request: {
        id: result.request.id,
        idempotencyKey: result.request.idempotencyKey,
        correlationId: result.request.correlationId,
        requestedAt: result.request.requestedAt,
        completedAt: result.request.completedAt,
      },
      workId: result.outbox.id,
      isNew: true,
    };
  }

  async findRequestById(requestId: string): Promise<FoundationDemoRequest | null> {
    const r = (await (this.prisma.foundationDemoRequest as any).findUnique({ where: { id: requestId } })) as any;
    if (!r) return null;
    return {
      id: r.id,
      idempotencyKey: r.idempotencyKey,
      correlationId: r.correlationId,
      requestedAt: r.requestedAt,
      completedAt: r.completedAt,
    };
  }

  async findRequestByIdempotencyKey(key: string) {
    return (this.prisma.foundationDemoRequest as any).findUnique({ where: { idempotencyKey: key } });
  }

  async findEffectByRequestId(requestId: string): Promise<FoundationDemoEffect | null> {
    const e = (await (this.prisma.foundationDemoEffect as any).findUnique({ where: { requestId } })) as any;
    if (!e) return null;
    return {
      id: e.id,
      requestId: e.requestId,
      outboxId: e.outboxId,
      correlationId: e.correlationId,
      appliedAt: e.appliedAt,
    };
  }

  async findEffectByOutboxId(outboxId: string) {
    return (this.prisma.foundationDemoEffect as any).findUnique({ where: { outboxId } });
  }

  async findOutboxById(workId: string): Promise<OutboxMessageRef | null> {
    const m = (await (this.prisma.outboxMessage as any).findUnique({ where: { id: workId } })) as any;
    if (!m) return null;
    return {
      id: m.id,
      status: m.status as any,
      attemptCount: m.attemptCount,
      lastErrorCode: m.lastErrorCode,
    };
  }

  async findOutboxByRequestId(requestId: string): Promise<OutboxMessageRef | null> {
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      const res = await client.query(
        `SELECT id, status, attempt_count, last_error_code FROM outbox_messages WHERE payload->>'requestId' = $1 LIMIT 1`,
        [requestId]
      );
      if (res.rows.length === 0) return null;
      return {
        id: res.rows[0].id,
        status: res.rows[0].status,
        attemptCount: res.rows[0].attempt_count,
        lastErrorCode: res.rows[0].last_error_code,
      };
    } finally {
      client.release();
    }
  }

  async createEffect(params: { id: string; requestId: string; outboxId: string; correlationId: string }) {
    return (this.prisma.foundationDemoEffect as any).create({
      data: {
        id: params.id,
        requestId: params.requestId,
        outboxId: params.outboxId,
        correlationId: params.correlationId,
      },
    });
  }

  async completeRequest(requestId: string) {
    return (this.prisma.foundationDemoRequest as any).update({
      where: { id: requestId },
      data: { completedAt: new Date() },
    });
  }
}
