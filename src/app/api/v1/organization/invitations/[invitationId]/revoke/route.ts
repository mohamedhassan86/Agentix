import { dispatchRoute } from "@/app/lib/route-dispatch";
import { REVOKE_INVITATION_TYPE } from "@/application/identity/commands/revoke-invitation";

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "revokeInvitation",
    parse: async () => ({ invitationId: params.invitationId }),
    handlerType: REVOKE_INVITATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
