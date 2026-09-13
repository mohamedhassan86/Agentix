export const LEAVE_ORGANIZATION_TYPE = "identity.members.leave";

export interface LeaveOrganizationCommand {
  type: typeof LEAVE_ORGANIZATION_TYPE;
}
