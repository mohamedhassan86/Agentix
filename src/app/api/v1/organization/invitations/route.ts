import { dispatchRoute } from "@/app/lib/route-dispatch";
import { CREATE_INVITATION_TYPE } from "@/application/identity/commands/create-invitation";
import { LIST_INVITATIONS_TYPE } from "@/application/identity/queries/list-invitations";
import { createInvitationRequestSchema } from "@/application/identity/dto/invitation";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "listInvitations",
    parse: async () => ({
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    }),
    handlerType: LIST_INVITATIONS_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "createInvitation",
    parse: async (req) => createInvitationRequestSchema.parse(await req.json()),
    handlerType: CREATE_INVITATION_TYPE,
    auth: "required",
    successStatus: 201,
  });
}

export const dynamic = "force-dynamic";
