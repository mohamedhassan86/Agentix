export const PREVIEW_INVITATION_TYPE = "identity.invitation.preview";

export interface PreviewInvitationQuery {
  type: typeof PREVIEW_INVITATION_TYPE;
  invitationId: string;
  token: string;
}
