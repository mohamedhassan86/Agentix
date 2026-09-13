import { dispatchRoute } from "@/app/lib/route-dispatch";
import { LEAVE_ORGANIZATION_TYPE } from "@/application/identity/commands/leave-organization";

export async function DELETE(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "leaveActiveOrganization",
    parse: async () => ({}),
    handlerType: LEAVE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 204,
    emptyBody: true,
  });
}

export const dynamic = "force-dynamic";
