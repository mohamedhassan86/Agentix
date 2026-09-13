import type { RequestContext } from "@/application/shared/context/request-context";
import type { SignOutCommand } from "../commands/sign-out";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { requireActor, rethrowIdentity } from "../map-error";

export function createSignOutHandler(deps: IdentityHandlerDeps) {
  return async (_command: SignOutCommand, ctx: RequestContext): Promise<{ cleared: true }> => {
    requireActor(ctx.actor);
    try {
      const session = await deps.store.findSessionById(ctx.actor.sessionId);
      if (session && session.isValid(deps.clock.now())) {
        session.revoke(deps.clock.now());
        await deps.store.updateSession(session);
      }
      return { cleared: true };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
