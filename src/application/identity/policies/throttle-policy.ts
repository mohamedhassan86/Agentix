/**
 * Login throttle: 5 consecutive failures in a 15-minute window lock for 15 minutes.
 * Email is hashed (SHA-256) before storage; unknown emails use the same generic failure shape.
 */

import type { IdentityStore, ThrottleRecord } from "../ports/identity-store";

export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const THROTTLE_LOCK_MS = 15 * 60 * 1000;
export const THROTTLE_MAX_FAILURES = 5;

export class ThrottlePolicy {
  static isLocked(record: ThrottleRecord | null, now: Date): boolean {
    if (!record?.lockedUntil) return false;
    return record.lockedUntil.getTime() > now.getTime();
  }

  static async assertNotLocked(store: IdentityStore, emailNormalized: string, now: Date): Promise<boolean> {
    const record = await store.findThrottle(emailNormalized);
    return this.isLocked(record, now);
  }

  static async recordFailure(store: IdentityStore, emailNormalized: string, now: Date): Promise<ThrottleRecord> {
    return store.recordFailedAttempt(emailNormalized, now);
  }

  static async clear(store: IdentityStore, emailNormalized: string): Promise<void> {
    await store.resetThrottle(emailNormalized);
  }
}
