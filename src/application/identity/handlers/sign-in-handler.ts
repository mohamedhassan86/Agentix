import type { RequestContext } from "@/application/shared/context/request-context";
import { AuthenticationFailedError } from "@/domain/identity/errors/identity-errors";
import { Session } from "@/domain/identity/entities/session";
import { EmailAddress } from "@/domain/identity/value-objects/email-address";
import { UnauthorizedError, ValidationError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import type { SignInCommand } from "../commands/sign-in";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { ThrottlePolicy } from "../policies/throttle-policy";
import { identityAppError, rethrowIdentity } from "../map-error";
import type { SessionContext } from "../dto/sign-in";

export interface SignInResult {
  sessionContext: SessionContext;
  rawSessionToken: string;
}

export function createSignInHandler(deps: IdentityHandlerDeps) {
  return async (command: SignInCommand, _ctx: RequestContext): Promise<SignInResult> => {
    let email: EmailAddress;
    try {
      email = EmailAddress.create(command.email);
    } catch {
      throw new ValidationError("Validation failed", { email: ["Invalid email"] });
    }

    const fail = async (recordFailure: boolean): Promise<never> => {
      if (recordFailure) {
        await ThrottlePolicy.recordFailure(deps.store, email.normalized, deps.clock.now());
      }
      throw identityAppError(new AuthenticationFailedError());
    };

    try {
      const now = deps.clock.now();
      const locked = await ThrottlePolicy.assertNotLocked(deps.store, email.normalized, now);
      const user = await deps.store.findUserByEmailNormalized(email.normalized);

      if (locked) {
        await deps.hasher.verify(deps.hasher.getDummyHash(), command.password);
        throw identityAppError(new AuthenticationFailedError());
      }

      if (!user || user.isDeleted() || !user.canAuthenticate()) {
        await deps.hasher.verify(deps.hasher.getDummyHash(), command.password);
        return await fail(true);
      }

      const ok = await deps.hasher.verify(user.passwordHash, command.password);
      if (!ok) {
        return await fail(true);
      }

      await ThrottlePolicy.clear(deps.store, email.normalized);

      const issued = await deps.tokens.generate();
      const session = Session.start({
        id: issued.id,
        sessionTokenDigest: issued.digest,
        userId: user.id,
        expiresAt: new Date(now.getTime() + deps.sessionMaxAgeSeconds * 1000),
        now,
      });
      await deps.store.createSession(session);

      return {
        sessionContext: {
          userId: user.id,
          activeOrganizationId: null,
          activeRole: null,
          platformAdministrator: user.isPlatformAdmin,
        },
        rawSessionToken: issued.raw,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      rethrowIdentity(error);
    }
  };
}

export function authenticationFailed(): never {
  throw new UnauthorizedError("Invalid email or password", ErrorCodes.AUTHENTICATION_FAILED);
}
