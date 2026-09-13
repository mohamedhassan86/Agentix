import { dispatchRoute } from "@/app/lib/route-dispatch";
import { INSPECT_ORGANIZATION_TYPE } from "@/application/identity/queries/inspect-organization";

export async function GET(
  request: Request,
  { params }: { params: { organizationId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "inspectOrganization",
    parse: async () => ({ organizationId: params.organizationId }),
    handlerType: INSPECT_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
