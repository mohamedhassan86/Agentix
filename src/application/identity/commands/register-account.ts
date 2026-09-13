export const REGISTER_ACCOUNT_TYPE = "identity.account.register";

export interface RegisterAccountCommand {
  type: typeof REGISTER_ACCOUNT_TYPE;
  email: string;
  displayName: string;
  password: string;
}
