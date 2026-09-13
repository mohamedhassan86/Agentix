import type { RequestContext } from "@/application/shared/context/request-context";
import { RegistrationFailedError } from "@/domain/identity/errors/identity-errors";
import { UserAccount } from "@/domain/identity/entities/user-account";
import { OneTimeToken } from "@/domain/identity/entities/one-time-token";
import { EmailAddress } from "@/domain/identity/value-objects/email-address";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import { ValidationError } from "@/application/shared/errors/app-error";
import type { RegisterResult } from "../dto/register";
import type { RegisterAccountCommand } from "../commands/register-account";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";
import { outboxAad, recipientHash, verificationActionUrl } from "../crypto-util";

export function createRegisterAccountHandler(deps: IdentityHandlerDeps) {
  return async (command: RegisterAccountCommand, _ctx: RequestContext): Promise<RegisterResult> => {
    let email: EmailAddress;
    try {
      email = EmailAddress.create(command.email);
    } catch {
      throw new ValidationError("Validation failed", { email: ["Invalid email"] });
    }

    const displayName = command.displayName.trim();
    if (!displayName) {
      throw new ValidationError("Validation failed", { displayName: ["Display name is required"] });
    }

    try {
      return await deps.store.transaction(async (store) => {
        const existing = await store.findUserByEmailNormalized(email.normalized);
        if (existing) {
          throw new RegistrationFailedError();
        }

        const now = deps.clock.now();
        const passwordHash = await deps.hasher.hash(command.password);
        const user = UserAccount.register({
          id: deps.ids.generate(),
          emailNormalized: email.normalized,
          displayName,
          passwordHash,
          now,
        });

        const issued = await deps.tokens.generate();
        const token = OneTimeToken.issueVerification({
          id: issued.id,
          userId: user.id,
          tokenDigest: issued.digest,
          now,
        });

        const outboxId = deps.ids.generate();
        const recHash = recipientHash(email.normalized);
        const keyVersion = deps.deliveryKeyVersion;
        const aad = outboxAad({
          outboxId,
          messageKind: "verification",
          recipientHash: recHash,
          keyVersion,
        });
        const actionUrl = verificationActionUrl(deps.origin, issued.raw);
        const plaintext = JSON.stringify({
          recipient: email.normalized,
          template: "email-verification",
          parameters: {
            displayName: user.displayName,
            actionUrl,
            expiresAt: token.expiresAt.toISOString(),
          },
        });
        const encrypted = await deps.encryption.encrypt(plaintext, aad, keyVersion);

        await store.createUser(user);
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
          capturedRecipient: email.normalized,
          capturedTemplate: "email-verification",
        });

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "account.registered",
            organizationId: null,
            actorUserId: user.id,
            subjectUserId: user.id,
            objectType: "user",
            objectId: user.id,
            sequence,
            occurredAt: now,
            data: { verified: false },
          }),
        );

        return {
          account: {
            id: user.id,
            email: email.normalized,
            displayName: user.displayName,
            emailVerified: false,
            platformAdministrator: false,
            createdAt: user.createdAt.toISOString(),
          },
          verificationMessageQueued: true as const,
        };
      });
    } catch (error) {
      if (error instanceof RegistrationFailedError) throw identityAppError(error);
      rethrowIdentity(error);
    }
  };
}
