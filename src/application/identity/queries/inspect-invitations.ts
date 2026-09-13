export const INSPECT_INVITATIONS_TYPE = "identity.platform.inspectInvitations";

export interface InspectInvitationsQuery {
  type: typeof INSPECT_INVITATIONS_TYPE;
  organizationId: string;
  cursor?: string;
  limit?: number;
}
