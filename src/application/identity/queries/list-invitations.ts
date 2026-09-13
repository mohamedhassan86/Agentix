export const LIST_INVITATIONS_TYPE = "identity.invitation.list";

export interface ListInvitationsQuery {
  type: typeof LIST_INVITATIONS_TYPE;
  cursor?: string;
  limit?: number;
}
