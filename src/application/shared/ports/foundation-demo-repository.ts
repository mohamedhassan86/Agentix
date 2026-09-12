import type { WorkEnvelope } from "../work/work-envelope";

export interface FoundationDemoRequest {
  id: string;
  idempotencyKey: string;
  correlationId: string;
  requestedAt: Date;
  completedAt: Date | null;
}

export interface FoundationDemoEffect {
  id: string;
  requestId: string;
  outboxId: string;
  correlationId: string;
  appliedAt: Date;
}

export interface OutboxMessageRef {
  id: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  attemptCount: number;
  lastErrorCode: string | null;
}

export interface IFoundationDemoRepository {
  createRequestWithOutboxAtomic(params: {
    requestId: string;
    idempotencyKey: string;
    correlationId: string;
    envelope: WorkEnvelope;
  }): Promise<{ request: FoundationDemoRequest; workId: string; isNew: boolean }>;

  findRequestById(requestId: string): Promise<FoundationDemoRequest | null>;
  findEffectByRequestId(requestId: string): Promise<FoundationDemoEffect | null>;
  findOutboxById(workId: string): Promise<OutboxMessageRef | null>;
  findOutboxByRequestId(requestId: string): Promise<OutboxMessageRef | null>;
}
