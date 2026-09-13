import { dispatchRoute } from "@/app/lib/route-dispatch";
import { SIGN_OUT_TYPE } from "@/application/identity/commands/sign-out";

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "signOut",
    parse: async () => ({}),
    handlerType: SIGN_OUT_TYPE,
    auth: "required",
    successStatus: 204,
    emptyBody: true,
    clearSessionCookie: true,
  });
}

export const dynamic = "force-dynamic";
