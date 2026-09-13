import type { RequestContext } from "@/application/shared/context/request-context";
import { NotFoundError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import type { GetCurrentAccountQuery } from "../queries/get-current-account";
import type { Account } from "../dto/account";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor, rethrowIdentity } from "../map-error";

export function createGetCurrentAccountHandler(deps: IdentityHandlerDeps) {
  return async (_query: GetCurrentAccountQuery, ctx: RequestContext): Promise<Account> => {
    requireActor(ctx.actor);
    try {
      const user = await deps.store.findUserById(ctx.actor!.userId);
      if (!user || user.isDeleted()) {
        throw new NotFoundError("Account not found", ErrorCodes.NOT_FOUND);
      }
      return {
        id: user.id,
        email: user.emailNormalized,
        displayName: user.displayName,
        emailVerified: user.isVerified(),
        platformAdministrator: user.isPlatformAdmin,
        createdAt: user.createdAt.toISOString(),
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
