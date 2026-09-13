export const INSPECT_ORGANIZATION_TYPE = "identity.platform.inspectOrganization";

export interface InspectOrganizationQuery {
  type: typeof INSPECT_ORGANIZATION_TYPE;
  organizationId: string;
}
