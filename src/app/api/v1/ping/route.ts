import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_PING_TYPE } from "@/application/foundation/queries/ping";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getPing",
    handlerType: GET_PING_TYPE,
    parse: () => ({ type: GET_PING_TYPE }),
  });
}

export const dynamic = "force-dynamic";
