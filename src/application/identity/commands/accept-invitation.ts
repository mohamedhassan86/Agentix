export const ACCEPT_INVITATION_TYPE = "identity.invitation.accept";

export interface AcceptInvitationCommand {
  type: typeof ACCEPT_INVITATION_TYPE;
  invitationId: string;
  token: string;
}
