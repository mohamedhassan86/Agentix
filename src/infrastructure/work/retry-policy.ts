/**
 * Bounded retry policy with base delay 1s, cap 30s, jitter.
 * Max attempts 3 by default (bounded 1-10).
 */

export interface RetryPolicyOptions {
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxAttempts?: number;
}

export class RetryPolicy {
  private baseDelayMs: number;
  private maxDelayMs: number;
  private maxAttempts: number;

  constructor(options: RetryPolicyOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.maxAttempts = options.maxAttempts ?? 3;

    if (this.maxAttempts < 1 || this.maxAttempts > 10) {
      throw new Error("maxAttempts must be 1-10");
    }
  }

  shouldRetry(attemptCount: number, maxAttempts: number): boolean {
    return attemptCount < maxAttempts;
  }

  getNextDelay(attemptNumber: number): number {
    // Exponential backoff: base * 2^(attempt-1) with cap and jitter
    const exponential = this.baseDelayMs * Math.pow(2, attemptNumber - 1);
    const capped = Math.min(exponential, this.maxDelayMs);
    const jitter = capped * 0.1 * (Math.random() * 2 - 1); // ±10% jitter
    return Math.max(0, Math.floor(capped + jitter));
  }

  getNextAvailableAt(attemptNumber: number): Date {
    const delay = this.getNextDelay(attemptNumber);
    return new Date(Date.now() + delay);
  }
}
