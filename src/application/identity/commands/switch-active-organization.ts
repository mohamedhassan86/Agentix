export const SWITCH_ACTIVE_ORGANIZATION_TYPE = "identity.session.switchOrganization";

export interface SwitchActiveOrganizationCommand {
  type: typeof SWITCH_ACTIVE_ORGANIZATION_TYPE;
  organizationId: string;
}
