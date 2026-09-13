export const SIGN_OUT_TYPE = "identity.session.signOut";

export interface SignOutCommand {
  type: typeof SIGN_OUT_TYPE;
}
