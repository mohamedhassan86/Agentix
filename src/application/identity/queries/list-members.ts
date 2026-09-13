export const LIST_MEMBERS_TYPE = "identity.members.list";

export interface ListMembersQuery {
  type: typeof LIST_MEMBERS_TYPE;
  cursor?: string;
  limit?: number;
}
