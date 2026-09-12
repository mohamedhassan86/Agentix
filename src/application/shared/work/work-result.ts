/**
 * WorkResult - closed outcome for work handler execution.
 * Handlers must return one of these, never throw sensitive data.
 */

export type WorkResultOutcome = "succeeded" | "retry_scheduled" | "failed" | "cancelled" | "lease_expired";

export interface WorkResult {
  outcome: WorkResultOutcome;
  errorCode?: string; // stable code, 1-120 chars, no sensitive data
  nextAvailableAt?: Date; // for retry_scheduled
  durationMs?: number;
}

export function successResult(durationMs?: number): WorkResult {
  return { outcome: "succeeded", durationMs };
}

export function retryResult(nextAvailableAt: Date, errorCode?: string, durationMs?: number): WorkResult {
  return {
    outcome: "retry_scheduled",
    nextAvailableAt,
    errorCode: errorCode?.slice(0, 120),
    durationMs,
  };
}

export function failedResult(errorCode: string, durationMs?: number): WorkResult {
  return {
    outcome: "failed",
    errorCode: errorCode.slice(0, 120),
    durationMs,
  };
}

export function cancelledResult(durationMs?: number): WorkResult {
  return { outcome: "cancelled", durationMs };
}

export const CLOSED_OUTCOMES: WorkResultOutcome[] = [
  "succeeded",
  "retry_scheduled",
  "failed",
  "cancelled",
  "lease_expired",
];

export function isValidOutcome(outcome: string): outcome is WorkResultOutcome {
  return (CLOSED_OUTCOMES as string[]).includes(outcome);
}
