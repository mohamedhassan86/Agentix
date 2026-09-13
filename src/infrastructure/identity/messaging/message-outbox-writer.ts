/**
 * Message outbox writer - reuses foundation outbox with encrypted payload
 * Redacted metadata: messageId, messageKind, recipientHash, keyVersion, availableAt, attempt
 */

import type { PrismaClient } from "../../../generated/prisma/client";
import type { MessageEncryption } from "../../../application/identity/ports/message-encryption";
import { IdentityOutboxWriter } from "../persistence/outbox-extension";
import { v7 as uuidv7 } from "uuid";

export class MessageOutboxWriter {
  private readonly outboxWriter: IdentityOutboxWriter;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly encryption: MessageEncryption
  ) {
    this.outboxWriter = new IdentityOutboxWriter(prisma);
  }

  async writeVerificationMessage(params: {
    recipientEmail: string;
    displayName: string;
    actionUrl: string; // contains raw token - will be encrypted
    expiresAt: Date;
    correlationId: string;
  }): Promise<string> {
    const id = uuidv7();
    const plaintext = JSON.stringify({
      recipient: params.recipientEmail,
      template: "email-verification",
      parameters: {
        displayName: params.displayName,
        actionUrl: params.actionUrl,
        expiresAt: params.expiresAt.toISOString(),
      },
    });

    const recipientHash = IdentityOutboxWriter.hashRecipient(params.recipientEmail);
    const aad = `${id}|verification|${recipientHash}|1`;
    const encrypted = await this.encryption.encrypt(plaintext, aad, 1);

    await this.outboxWriter.writeEncrypted({
      id,
      workType: "identity.verification",
      orgId: null,
      messageKind: "verification",
      recipientEmail: params.recipientEmail,
      encrypted,
      correlationId: params.correlationId,
      idempotencyKey: `verification-${params.recipientEmail}-${Date.now()}`,
    });

    return id;
  }

  async writeInvitationMessage(params: {
    orgId: string;
    orgName: string;
    recipientEmail: string;
    inviterDisplayName: string;
    role: string;
    actionUrl: string;
    expiresAt: Date;
    correlationId: string;
    invitationId: string;
  }): Promise<string> {
    const id = uuidv7();
    const plaintext = JSON.stringify({
      recipient: params.recipientEmail,
      template: "invitation",
      parameters: {
        organizationName: params.orgName,
        inviterDisplayName: params.inviterDisplayName,
        role: params.role,
        actionUrl: params.actionUrl,
        expiresAt: params.expiresAt.toISOString(),
      },
    });

    const recipientHash = IdentityOutboxWriter.hashRecipient(params.recipientEmail);
    const aad = `${id}|invitation|${recipientHash}|1`;
    const encrypted = await this.encryption.encrypt(plaintext, aad, 1);

    await this.outboxWriter.writeEncrypted({
      id,
      workType: "identity.invitation",
      orgId: params.orgId,
      messageKind: "invitation",
      recipientEmail: params.recipientEmail,
      encrypted,
      correlationId: params.correlationId,
      idempotencyKey: `invitation-${params.invitationId}-${Date.now()}`,
    });

    return id;
  }
}
