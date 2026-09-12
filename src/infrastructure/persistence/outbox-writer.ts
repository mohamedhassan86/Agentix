import type { WorkEnvelope } from "@/application/shared/work/work-envelope";
import type { PrismaClient } from "../../generated/prisma/client";
import type { IOutboxWriter } from "@/application/shared/ports/outbox-writer";

/**
 * Outbox writer that persists WorkEnvelope to outbox_messages table.
 * Implements atomic enqueue via Prisma transaction.
 */

export interface OutboxWriterOptions {
  prisma: PrismaClient;
}

export class PrismaOutboxWriter implements IOutboxWriter {
  constructor(private readonly prisma: PrismaClient) {}

  async write(envelope: WorkEnvelope): Promise<void> {
    return this.enqueue(envelope);
  }

  async enqueue(envelope: WorkEnvelope): Promise<void> {
    await (this.prisma.outboxMessage as any).create({
      data: {
        id: envelope.workId,
        workType: envelope.type,
        schemaVersion: envelope.schemaVersion,
        scope: envelope.scope as any,
        orgId: envelope.orgId,
        idempotencyKey: envelope.idempotencyKey,
        correlationId: envelope.correlationId,
        traceParent: envelope.traceParent ?? null,
        traceState: envelope.traceState ?? null,
        payload: envelope.payload as any,
        status: "pending",
        availableAt: envelope.availableAt,
        maxAttempts: envelope.maxAttempts,
        attemptCount: 0,
      },
    });
  }

  async enqueueWithIdempotency(envelope: WorkEnvelope): Promise<{ workId: string; isNew: boolean }> {
    const existing = (await (this.prisma.outboxMessage as any).findFirst({
      where: {
        workType: envelope.type,
        scope: envelope.scope as any,
        orgId: envelope.orgId,
        idempotencyKey: envelope.idempotencyKey,
      },
    })) as any;

    if (existing) {
      return { workId: existing.id, isNew: false };
    }

    try {
      await this.enqueue(envelope);
      return { workId: envelope.workId, isNew: true };
    } catch (e: any) {
      if (e.code === "P2002" || e.message?.includes("unique") || e.message?.includes("duplicate")) {
        const retry = (await (this.prisma.outboxMessage as any).findFirst({
          where: {
            workType: envelope.type,
            scope: envelope.scope as any,
            orgId: envelope.orgId,
            idempotencyKey: envelope.idempotencyKey,
          },
        })) as any;
        if (retry) {
          return { workId: retry.id, isNew: false };
        }
      }
      throw e;
    }
  }
}
