export const RESEND_INVITATION_TYPE = "identity.invitation.resend";

export interface ResendInvitationCommand {
  type: typeof RESEND_INVITATION_TYPE;
  invitationId: string;
}
