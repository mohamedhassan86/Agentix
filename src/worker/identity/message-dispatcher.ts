/**
 * Polls identity outbox, decrypts inside the adapter only, delivers, and purges ciphertext
 * after terminal success or failed-forever. Never logs raw tokens.
 */

import type { IdentityStore } from "@/application/identity/ports/identity-store";
import type { MessageEncryption } from "@/application/identity/ports/message-encryption";
import type { MessageDeliveryPort } from "@/application/identity/ports/message-delivery";
import type { IClock } from "@/application/shared/ports/clock";
import type { IIdGenerator } from "@/application/shared/ports/id-generator";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { outboxAad } from "@/application/identity/crypto-util";
import { getLogger } from "@/infrastructure/observability/logger";

export interface MessageDispatcherDeps {
  store: IdentityStore;
  encryption: MessageEncryption;
  delivery: MessageDeliveryPort;
  clock: IClock;
  ids: IIdGenerator;
  maxAttempts?: number;
}

export async function dispatchIdentityMessages(deps: MessageDispatcherDeps, limit = 10): Promise<number> {
  const logger = getLogger();
  const pending = await deps.store.findPendingEncryptedOutbox(limit);
  let processed = 0;
  const maxAttempts = deps.maxAttempts ?? 3;

  for (const record of pending) {
    const now = deps.clock.now();
    record.attemptCount += 1;
    record.status = "processing";
    await deps.store.updateOutbox(record);

    try {
      if (!record.ciphertext || !record.nonce || !record.tag) {
        throw new Error("MISSING_CIPHERTEXT");
      }
      const aad = outboxAad({
        outboxId: record.id,
        messageKind: record.messageKind,
        recipientHash: record.recipientHash,
        keyVersion: record.keyVersion,
      });
      const plaintext = await deps.encryption.decrypt(
        {
          ciphertext: record.ciphertext,
          nonce: record.nonce,
          tag: record.tag,
          keyVersion: record.keyVersion,
        },
        aad,
      );
      const parsed = JSON.parse(plaintext) as {
        recipient: string;
        template: string;
        parameters: { actionUrl: string; expiresAt: string; displayName?: string };
      };
      const result = await deps.delivery.send({
        recipient: parsed.recipient,
        template: parsed.template,
        parameters: parsed.parameters,
      });

      if (result.success) {
        record.status = "succeeded";
        record.lastErrorCode = null;
        await deps.store.updateOutbox(record);
        await deps.store.purgeOutboxCiphertext(record.id);
        const sequence = await deps.store.nextEventSequence();
        await deps.store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "message.delivery_succeeded",
            organizationId: record.orgId,
            objectType: "outbox",
            objectId: record.id,
            sequence,
            occurredAt: now,
            data: { messageKind: record.messageKind, attempt: record.attemptCount },
          }),
        );
      } else {
        const terminal = record.attemptCount >= maxAttempts;
        record.status = terminal ? "failed" : "pending";
        record.lastErrorCode = result.errorCode;
        await deps.store.updateOutbox(record);
        if (terminal) {
          await deps.store.purgeOutboxCiphertext(record.id);
          const sequence = await deps.store.nextEventSequence();
          await deps.store.appendEvent(
            createIdentityEvent({
              eventId: deps.ids.generate(),
              eventType: "message.delivery_failed",
              organizationId: record.orgId,
              objectType: "outbox",
              objectId: record.id,
              sequence,
              occurredAt: now,
              data: { messageKind: record.messageKind, attempt: record.attemptCount, errorCode: result.errorCode },
            }),
          );
        }
      }
      processed += 1;
    } catch (error) {
      logger.warn({ msg: "identity message dispatch failed", code: "DISPATCH_FAILED", outboxId: record.id });
      const terminal = record.attemptCount >= maxAttempts;
      record.status = terminal ? "failed" : "pending";
      record.lastErrorCode = "UNKNOWN";
      await deps.store.updateOutbox(record);
      if (terminal) {
        await deps.store.purgeOutboxCiphertext(record.id);
      }
      void error;
    }
  }

  return processed;
}
