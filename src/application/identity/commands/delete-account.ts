export const DELETE_ACCOUNT_TYPE = "identity.account.delete";

export interface DeleteAccountCommand {
  type: typeof DELETE_ACCOUNT_TYPE;
  confirmation: "DELETE";
}
