import type { RequestContext } from "@/application/shared/context/request-context";
import { TokenInvalidError } from "@/domain/identity/errors/identity-errors";
import { parseRawTokenFormat } from "@/domain/identity/value-objects/opaque-token-digest";
import type { PreviewInvitationQuery } from "../queries/preview-invitation";
import type { InvitationPreview } from "../dto/invitation";
import type { IdentityHandlerDeps } from "../ports/identity-store";
import { identityAppError, rethrowIdentity } from "../map-error";

export function createPreviewInvitationHandler(deps: IdentityHandlerDeps) {
  return async (query: PreviewInvitationQuery, _ctx: RequestContext): Promise<InvitationPreview> => {
    try {
      let parsed: { id: string; secret: string };
      try {
        parsed = parseRawTokenFormat(query.token);
      } catch {
        throw identityAppError(new TokenInvalidError());
      }
      const candidateDigest = await deps.tokens.digestSecret(parsed.secret);
      const token = await deps.store.findTokenById(parsed.id);
      if (!token || token.purpose !== "invitation_acceptance" || token.invitationId !== query.invitationId) {
        throw identityAppError(new TokenInvalidError());
      }
      if (!deps.tokens.verifyDigest(token.tokenDigest, candidateDigest)) {
        throw identityAppError(new TokenInvalidError());
      }
      const invitation = await deps.store.findInvitationById(query.invitationId);
      if (!invitation) throw identityAppError(new TokenInvalidError());
      const org = await deps.store.findOrgById(invitation.orgId);
      const now = deps.clock.now();
      const account = await deps.store.findUserByEmailNormalized(invitation.emailNormalized);
      return {
        invitationId: invitation.id,
        organizationName: org && !org.isDeleted() ? org.name : "Organization",
        invitedEmail: invitation.emailNormalized,
        role: invitation.role,
        status: invitation.getEffectiveStatus(now),
        expiresAt: invitation.expiresAt.toISOString(),
        accountRequired: !account || account.isDeleted(),
      };
    } catch (error) {
      rethrowIdentity(error);
    }
  };
}
