import { dispatchRoute } from "@/app/lib/route-dispatch";
import { LIST_MEMBERS_TYPE } from "@/application/identity/queries/list-members";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "listActiveOrganizationMembers",
    parse: async () => ({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    handlerType: LIST_MEMBERS_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
