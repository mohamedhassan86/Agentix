import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_LIVENESS_TYPE } from "@/application/foundation/queries/health";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getLiveness",
    handlerType: GET_LIVENESS_TYPE,
    parse: () => ({ type: GET_LIVENESS_TYPE }),
  });
}

export const dynamic = "force-dynamic";
