import type { PrismaClient } from "../../../generated/prisma/client";
import { createHash } from "crypto";

export interface ThrottleRecord {
  emailKey: Uint8Array;
  failedCount: number;
  windowStartedAt: Date;
  lockedUntil: Date | null;
  updatedAt: Date;
}

export class ThrottleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  static hashEmail(emailNormalized: string): Uint8Array {
    const hash = createHash("sha256").update(emailNormalized.toLowerCase().trim()).digest();
    return new Uint8Array(hash);
  }

  async findByEmailKey(emailKey: Uint8Array): Promise<ThrottleRecord | null> {
    const row = await (this.prisma.loginThrottle as any).findUnique({
      where: { emailKey: emailKey as any },
    });
    if (!row) return null;
    return {
      emailKey: row.emailKey,
      failedCount: row.failedCount,
      windowStartedAt: row.windowStartedAt,
      lockedUntil: row.lockedUntil,
      updatedAt: row.updatedAt,
    };
  }

  async findByEmail(emailNormalized: string): Promise<ThrottleRecord | null> {
    const key = ThrottleRepository.hashEmail(emailNormalized);
    return this.findByEmailKey(key);
  }

  async upsertFailedAttempt(emailNormalized: string, now: Date): Promise<ThrottleRecord> {
    const emailKey = ThrottleRepository.hashEmail(emailNormalized);
    const existing = await this.findByEmailKey(emailKey);

    if (!existing) {
      const row = await (this.prisma.loginThrottle as any).create({
        data: {
          emailKey: emailKey as any,
          failedCount: 1,
          windowStartedAt: now,
          lockedUntil: null,
          updatedAt: now,
        },
      });
      return {
        emailKey: row.emailKey,
        failedCount: row.failedCount,
        windowStartedAt: row.windowStartedAt,
        lockedUntil: row.lockedUntil,
        updatedAt: row.updatedAt,
      };
    }

    // Check if window expired (15 min)
    const windowMs = 15 * 60 * 1000;
    const isWindowExpired = now.getTime() - existing.windowStartedAt.getTime() > windowMs;

    let failedCount: number;
    let windowStartedAt: Date;
    let lockedUntil: Date | null = existing.lockedUntil;

    if (isWindowExpired) {
      failedCount = 1;
      windowStartedAt = now;
      lockedUntil = null;
    } else {
      failedCount = existing.failedCount + 1;
      windowStartedAt = existing.windowStartedAt;
      if (failedCount >= 5) {
        lockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
      }
    }

    // If already locked and lock not expired, keep locked
    if (existing.lockedUntil && existing.lockedUntil.getTime() > now.getTime()) {
      lockedUntil = existing.lockedUntil;
    }

    const row = await (this.prisma.loginThrottle as any).update({
      where: { emailKey: emailKey as any },
      data: {
        failedCount,
        windowStartedAt,
        lockedUntil,
        updatedAt: now,
      },
    });

    return {
      emailKey: row.emailKey,
      failedCount: row.failedCount,
      windowStartedAt: row.windowStartedAt,
      lockedUntil: row.lockedUntil,
      updatedAt: row.updatedAt,
    };
  }

  async resetByEmail(emailNormalized: string): Promise<void> {
    const emailKey = ThrottleRepository.hashEmail(emailNormalized);
    await (this.prisma.loginThrottle as any).deleteMany({
      where: { emailKey: emailKey as any },
    });
  }

  async isLocked(emailNormalized: string, now: Date = new Date()): Promise<boolean> {
    const record = await this.findByEmail(emailNormalized);
    if (!record) return false;
    if (!record.lockedUntil) return false;
    return record.lockedUntil.getTime() > now.getTime();
  }
}
