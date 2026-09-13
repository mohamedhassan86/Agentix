/**
 * Outbox extension for identity - encrypted envelope
 * Reuses foundation outbox_messages with additional encrypted columns
 */

import type { PrismaClient } from "../../../generated/prisma/client";
import type { EncryptedPayload } from "../../../application/identity/ports/message-encryption";
import { createHash } from "crypto";

export interface IdentityOutboxMessage {
  id: string;
  workType: string;
  orgId: string | null;
  messageKind: "verification" | "invitation";
  recipientHash: string;
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  tag: Uint8Array;
  keyVersion: number;
  availableAt: Date;
  createdAt: Date;
}

export class IdentityOutboxWriter {
  constructor(private readonly prisma: PrismaClient) {}

  static hashRecipient(email: string): string {
    const hash = createHash("sha256").update(email.toLowerCase().trim()).digest("base64url");
    return `sha256:${hash}`;
  }

  async writeEncrypted(params: {
    id: string;
    workType: string;
    orgId?: string | null;
    messageKind: "verification" | "invitation";
    recipientEmail: string;
    encrypted: EncryptedPayload;
    availableAt?: Date;
    correlationId: string;
    idempotencyKey: string;
  }): Promise<void> {
    const recipientHash = IdentityOutboxWriter.hashRecipient(params.recipientEmail);
    const now = new Date();

    await (this.prisma.outboxMessage as any).create({
      data: {
        id: params.id,
        workType: params.workType,
        schemaVersion: 1,
        scope: params.orgId ? "tenant" : "global",
        orgId: params.orgId ?? null,
        idempotencyKey: params.idempotencyKey,
        correlationId: params.correlationId,
        payload: {
          // Redacted payload - no token, only metadata
          messageKind: params.messageKind,
          recipientHash,
          keyVersion: params.encrypted.keyVersion,
          redacted: true,
        } as any,
        status: "pending",
        availableAt: params.availableAt ?? now,
        maxAttempts: 3,
        attemptCount: 0,
        messageKind: params.messageKind,
        recipientHash,
        ciphertext: params.encrypted.ciphertext as any,
        nonce: params.encrypted.nonce as any,
        tag: params.encrypted.tag as any,
        keyVersion: params.encrypted.keyVersion,
        encryptedAt: now,
      },
    });
  }

  async findEncryptedById(id: string): Promise<any> {
    return (this.prisma.outboxMessage as any).findUnique({ where: { id } });
  }

  async purgeCiphertext(id: string): Promise<void> {
    // Purge token-bearing ciphertext after terminal delivery
    await (this.prisma.outboxMessage as any).update({
      where: { id },
      data: {
        ciphertext: null,
        nonce: null,
        tag: null,
      },
    });
  }

  async findPendingByKind(kind: "verification" | "invitation", limit = 10) {
    return (this.prisma.outboxMessage as any).findMany({
      where: {
        messageKind: kind,
        status: "pending",
        availableAt: { lte: new Date() },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      take: limit,
    });
  }
}
