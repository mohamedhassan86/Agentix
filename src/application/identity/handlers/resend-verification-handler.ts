import type { RequestContext } from "@/application/shared/context/request-context";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import { ConflictError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import type { ResendVerificationCommand } from "../commands/resend-verification";
import type { MessageQueuedResult } from "../dto/verification";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor, rethrowIdentity } from "../map-error";
import { outboxAad, recipientHash, verificationActionUrl } from "../crypto-util";

export function createResendVerificationHandler(deps: IdentityHandlerDeps) {
  return async (_command: ResendVerificationCommand, ctx: RequestContext): Promise<MessageQueuedResult> => {
    requireActor(ctx.actor);
    try {
      return await deps.store.transaction(async (store) => {
        const user = await store.findUserById(ctx.actor!.userId);
        if (!user || user.isDeleted()) {
          throw new ConflictError("Account not eligible", ErrorCodes.CONFLICT);
        }
        if (user.isVerified()) {
          throw new ConflictError("Account is already verified", ErrorCodes.CONFLICT);
        }

        const now = deps.clock.now();
        await store.revokeOutstandingTokens({
          userId: user.id,
          purpose: "email_verification",
          now,
        });

        const issued = await deps.tokens.generate();
        const latest = await store.findLatestTokenByUserPurpose(user.id, "email_verification");
        const version = (latest?.version ?? 0) + 1;
        const token = OneTimeToken.create({
          id: issued.id,
          purpose: "email_verification",
          userId: user.id,
          invitationId: null,
          orgId: null,
          tokenDigest: issued.digest,
          version,
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          consumedAt: null,
          revokedAt: null,
          createdAt: now,
        });

        const outboxId = deps.ids.generate();
        const recHash = recipientHash(user.emailNormalized);
        const keyVersion = deps.deliveryKeyVersion;
        const aad = outboxAad({
          outboxId,
          messageKind: "verification",
          recipientHash: recHash,
          keyVersion,
        });
        const actionUrl = verificationActionUrl(deps.origin, issued.raw);
        const plaintext = JSON.stringify({
          recipient: user.emailNormalized,
          template: "email-verification",
          parameters: {
            displayName: user.displayName,
            actionUrl,
            expiresAt: token.expiresAt.toISOString(),
          },
        });
        const encrypted = await deps.encryption.encrypt(plaintext, aad, keyVersion);

        await store.createToken(token);
        await store.writeEncryptedOutbox({
          id: outboxId,
          workType: "identity.verification",
          orgId: null,
          messageKind: "verification",
          recipientHash: recHash,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
          tag: encrypted.tag,
          keyVersion,
          status: "pending",
          availableAt: now,
          attemptCount: 0,
          lastErrorCode: null,
          capturedActionUrl: actionUrl,
          capturedRecipient: user.emailNormalized,
          capturedTemplate: "email-verification",
        });

        return { queued: true as const };
      });
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
