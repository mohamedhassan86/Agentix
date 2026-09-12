export type FoundationWorkStatus = "queued" | "processing" | "succeeded" | "failed";

export interface FoundationWorkResponse {
  requestId: string;
  workId: string;
  status: FoundationWorkStatus;
  attemptCount: number;
  effectCount: number;
  requestedAt: string;
  completedAt?: string | null;
  lastErrorCode?: string | null;
}

export interface CreateFoundationWorkRequest {
  idempotencyKey?: string;
  correlationId: string;
}

export interface GetFoundationWorkRequest {
  requestId: string;
  correlationId: string;
}
