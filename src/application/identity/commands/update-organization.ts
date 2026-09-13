export const UPDATE_ORGANIZATION_TYPE = "identity.organization.update";

export interface UpdateOrganizationCommand {
  type: typeof UPDATE_ORGANIZATION_TYPE;
  name?: string;
  slug?: string;
}
