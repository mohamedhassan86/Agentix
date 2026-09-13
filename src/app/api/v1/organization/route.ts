import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_ACTIVE_ORGANIZATION_TYPE } from "@/application/identity/queries/get-active-organization";
import { UPDATE_ORGANIZATION_TYPE } from "@/application/identity/commands/update-organization";
import { DELETE_ORGANIZATION_TYPE } from "@/application/identity/commands/delete-organization";
import { deleteOrganizationRequestSchema, updateOrganizationRequestSchema } from "@/application/identity/dto/organization";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getActiveOrganization",
    parse: async () => ({}),
    handlerType: GET_ACTIVE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "updateActiveOrganization",
    parse: async (req) => updateOrganizationRequestSchema.parse(await req.json()),
    handlerType: UPDATE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "deleteActiveOrganization",
    parse: async (req) => deleteOrganizationRequestSchema.parse(await req.json()),
    handlerType: DELETE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 204,
    emptyBody: true,
  });
}

export const dynamic = "force-dynamic";
