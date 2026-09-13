export const RESEND_VERIFICATION_TYPE = "identity.account.resendVerification";

export interface ResendVerificationCommand {
  type: typeof RESEND_VERIFICATION_TYPE;
}
