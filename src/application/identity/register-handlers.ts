import type { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import type { IdentityHandlerDeps } from "./ports/identity-store";
import { REGISTER_ACCOUNT_TYPE } from "./commands/register-account";
import { SIGN_IN_TYPE } from "./commands/sign-in";
import { SIGN_OUT_TYPE } from "./commands/sign-out";
import { VERIFY_EMAIL_TYPE } from "./commands/verify-email";
import { RESEND_VERIFICATION_TYPE } from "./commands/resend-verification";
import { GET_CURRENT_ACCOUNT_TYPE } from "./queries/get-current-account";
import { GET_SESSION_CONTEXT_TYPE } from "./queries/get-session-context";
import { DELETE_ACCOUNT_TYPE } from "./commands/delete-account";
import { createRegisterAccountHandler } from "./handlers/register-account-handler";
import { createSignInHandler } from "./handlers/sign-in-handler";
import { createSignOutHandler } from "./handlers/sign-out-handler";
import { createVerifyEmailHandler } from "./handlers/verify-email-handler";
import { createResendVerificationHandler } from "./handlers/resend-verification-handler";
import { createGetCurrentAccountHandler } from "./handlers/get-current-account-handler";
import { createGetSessionContextHandler } from "./handlers/get-session-context-handler";
import { createDeleteAccountHandler } from "./handlers/delete-account-handler";
import { CREATE_ORGANIZATION_TYPE } from "./commands/create-organization";
import { UPDATE_ORGANIZATION_TYPE } from "./commands/update-organization";
import { DELETE_ORGANIZATION_TYPE } from "./commands/delete-organization";
import { SUGGEST_SLUG_TYPE } from "./queries/suggest-slug";
import { LIST_MY_ORGANIZATIONS_TYPE } from "./queries/list-my-organizations";
import { GET_ACTIVE_ORGANIZATION_TYPE } from "./queries/get-active-organization";
import { createCreateOrganizationHandler } from "./handlers/create-organization-handler";
import { createUpdateOrganizationHandler } from "./handlers/update-organization-handler";
import { createDeleteOrganizationHandler } from "./handlers/delete-organization-handler";
import { createSuggestSlugHandler } from "./handlers/suggest-slug-handler";
import { createListMyOrganizationsHandler } from "./handlers/list-my-organizations-handler";
import { createGetActiveOrganizationHandler } from "./handlers/get-active-organization-handler";

export function registerIdentityAuthHandlers(dispatcher: Dispatcher, deps: IdentityHandlerDeps): void {
  dispatcher.register(REGISTER_ACCOUNT_TYPE, { handle: createRegisterAccountHandler(deps) } as any);
  dispatcher.register(SIGN_IN_TYPE, { handle: createSignInHandler(deps) } as any);
  dispatcher.register(SIGN_OUT_TYPE, { handle: createSignOutHandler(deps) } as any);
  dispatcher.register(VERIFY_EMAIL_TYPE, { handle: createVerifyEmailHandler(deps) } as any);
  dispatcher.register(RESEND_VERIFICATION_TYPE, { handle: createResendVerificationHandler(deps) } as any);
  dispatcher.register(GET_CURRENT_ACCOUNT_TYPE, { handle: createGetCurrentAccountHandler(deps) } as any);
  dispatcher.register(GET_SESSION_CONTEXT_TYPE, { handle: createGetSessionContextHandler(deps) } as any);
  dispatcher.register(DELETE_ACCOUNT_TYPE, { handle: createDeleteAccountHandler(deps) } as any);
  registerIdentityOrganizationHandlers(dispatcher, deps);
}

export function registerIdentityOrganizationHandlers(dispatcher: Dispatcher, deps: IdentityHandlerDeps): void {
  dispatcher.register(CREATE_ORGANIZATION_TYPE, { handle: createCreateOrganizationHandler(deps) } as any);
  dispatcher.register(UPDATE_ORGANIZATION_TYPE, { handle: createUpdateOrganizationHandler(deps) } as any);
  dispatcher.register(DELETE_ORGANIZATION_TYPE, { handle: createDeleteOrganizationHandler(deps) } as any);
  dispatcher.register(SUGGEST_SLUG_TYPE, { handle: createSuggestSlugHandler(deps) } as any);
  dispatcher.register(LIST_MY_ORGANIZATIONS_TYPE, { handle: createListMyOrganizationsHandler(deps) } as any);
  dispatcher.register(GET_ACTIVE_ORGANIZATION_TYPE, { handle: createGetActiveOrganizationHandler(deps) } as any);
}
