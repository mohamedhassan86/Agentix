export const LIST_MY_ORGANIZATIONS_TYPE = "identity.organization.listMine";

export interface ListMyOrganizationsQuery {
  type: typeof LIST_MY_ORGANIZATIONS_TYPE;
  cursor?: string;
  limit?: number;
}
