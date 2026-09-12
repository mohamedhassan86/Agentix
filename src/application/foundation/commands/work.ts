export interface CreateFoundationWorkCommand {
  type: "foundation.work.create";
  idempotencyKey?: string;
  correlationId: string;
}

export const CREATE_FOUNDATION_WORK_TYPE = "foundation.work.create";
