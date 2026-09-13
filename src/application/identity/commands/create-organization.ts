export const CREATE_ORGANIZATION_TYPE = "identity.organization.create";

export interface CreateOrganizationCommand {
  type: typeof CREATE_ORGANIZATION_TYPE;
  name: string;
  slug?: string;
}
