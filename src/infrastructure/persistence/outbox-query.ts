import type { PrismaClient } from "../../generated/prisma/client";

export interface OutboxMessageRecord {
  id: string;
  workType: string;
  schemaVersion: number;
  scope: "global" | "tenant";
  orgId: string | null;
  idempotencyKey: string;
  correlationId: string;
  traceParent: string | null;
  traceState: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "succeeded" | "failed";
  availableAt: Date;
  attemptCount: number;
  maxAttempts: number;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export class PrismaOutboxQuery {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(workId: string): Promise<OutboxMessageRecord | null> {
    const msg = (await (this.prisma.outboxMessage as any).findUnique({ where: { id: workId } })) as any;
    if (!msg) return null;
    return {
      id: msg.id,
      workType: msg.workType,
      schemaVersion: msg.schemaVersion,
      scope: msg.scope as any,
      orgId: msg.orgId,
      idempotencyKey: msg.idempotencyKey,
      correlationId: msg.correlationId,
      traceParent: msg.traceParent,
      traceState: msg.traceState,
      payload: msg.payload as any,
      status: msg.status as any,
      availableAt: msg.availableAt,
      attemptCount: msg.attemptCount,
      maxAttempts: msg.maxAttempts,
      leaseOwner: msg.leaseOwner,
      leaseExpiresAt: msg.leaseExpiresAt,
      lastErrorCode: msg.lastErrorCode,
      createdAt: msg.createdAt,
      startedAt: msg.startedAt,
      completedAt: msg.completedAt,
      updatedAt: msg.updatedAt,
    };
  }

  async findByIdempotency(type: string, scope: "global" | "tenant", orgId: string | null, idempotencyKey: string) {
    return (this.prisma.outboxMessage as any).findFirst({
      where: { workType: type, scope: scope as any, orgId, idempotencyKey },
    });
  }
}
