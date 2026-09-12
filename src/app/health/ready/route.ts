import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_READINESS_TYPE } from "@/application/foundation/queries/health";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getReadiness",
    handlerType: GET_READINESS_TYPE,
    parse: () => ({ type: GET_READINESS_TYPE }),
  });
}

export const dynamic = "force-dynamic";
