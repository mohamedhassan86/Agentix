import { dispatchRoute } from "@/app/lib/route-dispatch";
import { SWITCH_ACTIVE_ORGANIZATION_TYPE } from "@/application/identity/commands/switch-active-organization";
import { switchOrganizationRequestSchema } from "@/application/identity/dto/session";

export async function PUT(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "switchActiveOrganization",
    parse: async (req) => switchOrganizationRequestSchema.parse(await req.json()),
    handlerType: SWITCH_ACTIVE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
