import { dispatchRoute } from "@/app/lib/route-dispatch";
import { INSPECT_MEMBERS_TYPE } from "@/application/identity/queries/inspect-members";

export async function GET(
  request: Request,
  { params }: { params: { organizationId: string } },
): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "inspectOrganizationMembers",
    parse: async () => ({
      organizationId: params.organizationId,
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    handlerType: INSPECT_MEMBERS_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
