export const SIGN_IN_TYPE = "identity.session.signIn";

export interface SignInCommand {
  type: typeof SIGN_IN_TYPE;
  email: string;
  password: string;
}
