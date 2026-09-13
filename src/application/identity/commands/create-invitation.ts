export const CREATE_INVITATION_TYPE = "identity.invitation.create";

export interface CreateInvitationCommand {
  type: typeof CREATE_INVITATION_TYPE;
  email: string;
  role: "viewer" | "member" | "admin";
}
