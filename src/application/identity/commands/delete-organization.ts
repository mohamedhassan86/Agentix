export const DELETE_ORGANIZATION_TYPE = "identity.organization.delete";

export interface DeleteOrganizationCommand {
  type: typeof DELETE_ORGANIZATION_TYPE;
  confirmationSlug: string;
}
