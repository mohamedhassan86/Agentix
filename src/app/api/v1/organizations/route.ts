import { dispatchRoute } from "@/app/lib/route-dispatch";
import { CREATE_ORGANIZATION_TYPE } from "@/application/identity/commands/create-organization";
import { LIST_MY_ORGANIZATIONS_TYPE } from "@/application/identity/queries/list-my-organizations";
import { createOrganizationRequestSchema } from "@/application/identity/dto/organization";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "listMyOrganizations",
    parse: async () => ({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    handlerType: LIST_MY_ORGANIZATIONS_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "createOrganization",
    parse: async (req) => createOrganizationRequestSchema.parse(await req.json()),
    handlerType: CREATE_ORGANIZATION_TYPE,
    auth: "required",
    successStatus: 201,
  });
}

export const dynamic = "force-dynamic";
