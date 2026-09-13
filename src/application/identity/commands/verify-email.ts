export const VERIFY_EMAIL_TYPE = "identity.account.verifyEmail";

export interface VerifyEmailCommand {
  type: typeof VERIFY_EMAIL_TYPE;
  token: string;
}
