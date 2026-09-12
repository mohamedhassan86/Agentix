import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_FOUNDATION_WORK_TYPE } from "@/application/foundation/queries/work";

export async function GET(request: Request, { params }: { params: { requestId: string } }): Promise<Response> {
  const requestId = params.requestId;

  return dispatchRoute({
    request,
    operation: "getFoundationWork",
    handlerType: GET_FOUNDATION_WORK_TYPE,
    parse: () => ({
      type: GET_FOUNDATION_WORK_TYPE,
      requestId,
      correlationId: "", // will be overridden by route-dispatch correlation
    }),
  });
}

export const dynamic = "force-dynamic";
