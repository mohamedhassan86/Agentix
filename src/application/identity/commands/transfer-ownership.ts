export const TRANSFER_OWNERSHIP_TYPE = "identity.organization.transferOwnership";

export interface TransferOwnershipCommand {
  type: typeof TRANSFER_OWNERSHIP_TYPE;
  targetMemberId: string;
  confirmation: "TRANSFER";
}
