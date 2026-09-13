export const REVOKE_INVITATION_TYPE = "identity.invitation.revoke";

export interface RevokeInvitationCommand {
  type: typeof REVOKE_INVITATION_TYPE;
  invitationId: string;
}
