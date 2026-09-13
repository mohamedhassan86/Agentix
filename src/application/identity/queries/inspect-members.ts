export const INSPECT_MEMBERS_TYPE = "identity.platform.inspectMembers";

export interface InspectMembersQuery {
  type: typeof INSPECT_MEMBERS_TYPE;
  organizationId: string;
  cursor?: string;
  limit?: number;
}
