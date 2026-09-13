export const CHANGE_MEMBER_ROLE_TYPE = "identity.members.changeRole";

export interface ChangeMemberRoleCommand {
  type: typeof CHANGE_MEMBER_ROLE_TYPE;
  memberId: string;
  role: "viewer" | "member" | "admin";
}
