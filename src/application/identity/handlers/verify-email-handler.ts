import type { RequestContext } from "@/application/shared/context/request-context";
import { TokenInvalidError } from "@/domain/identity/errors/identity-errors";
import { parseRawTokenFormat } from "@/domain/identity/value-objects/opaque-token-digest";
import { createIdentityEvent } from "@/domain/identity/events/identity-events";
import type { VerifyEmailCommand } from "../commands/verify-email";
import type { VerificationResult } from "../dto/verification";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";

export function createVerifyEmailHandler(deps: IdentityHandlerDeps) {
  return async (command: VerifyEmailCommand, _ctx: RequestContext): Promise<VerificationResult> => {
    try {
      let parsed: { id: string; secret: string };
      try {
        parsed = parseRawTokenFormat(command.token);
      } catch {
        throw new TokenInvalidError();
      }

      const candidateDigest = await deps.tokens.digestSecret(parsed.secret);

      return await deps.store.transaction(async (store) => {
        const token = await store.findTokenById(parsed.id);
        if (!token || token.purpose !== "email_verification") {
          throw new TokenInvalidError();
        }
        if (!deps.tokens.verifyDigest(token.tokenDigest, candidateDigest)) {
          throw new TokenInvalidError();
        }

        const now = deps.clock.now();
        const user = token.userId ? await store.findUserById(token.userId) : null;
        if (!user || user.isDeleted()) {
          throw new TokenInvalidError();
        }

        if (user.isVerified()) {
          return { status: "already_verified" as const };
        }

        if (token.isRevoked() || token.isExpired(now) || token.isConsumed()) {
          throw new TokenInvalidError();
        }

        const { alreadyVerified } = user.markVerified(now);
        token.consume(now);
        await store.updateToken(token);
        await store.updateUser(user);

        const sequence = await store.nextEventSequence();
        await store.appendEvent(
          createIdentityEvent({
            eventId: deps.ids.generate(),
            eventType: "account.email_verified",
            organizationId: null,
            actorUserId: user.id,
            subjectUserId: user.id,
            objectType: "user",
            objectId: user.id,
            sequence,
            occurredAt: now,
            data: { result: alreadyVerified ? "already_verified" : "verified" },
          }),
        );

        return { status: alreadyVerified ? ("already_verified" as const) : ("verified" as const) };
      });
    } catch (error) {
      if (error instanceof TokenInvalidError) throw identityAppError(error);
      rethrowIdentity(error);
    }
  };
}
