import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_SESSION_CONTEXT_TYPE } from "@/application/identity/queries/get-session-context";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getSessionContext",
    parse: async () => ({}),
    handlerType: GET_SESSION_CONTEXT_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
