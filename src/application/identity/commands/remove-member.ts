export const REMOVE_MEMBER_TYPE = "identity.members.remove";

export interface RemoveMemberCommand {
  type: typeof REMOVE_MEMBER_TYPE;
  memberId: string;
}
