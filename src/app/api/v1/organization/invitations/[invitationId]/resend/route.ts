import { dispatchRoute } from "@/app/lib/route-dispatch";
import { RESEND_INVITATION_TYPE } from "@/application/identity/commands/resend-invitation";

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "resendInvitation",
    parse: async () => ({ invitationId: params.invitationId }),
    handlerType: RESEND_INVITATION_TYPE,
    auth: "required",
    successStatus: 202,
  });
}

export const dynamic = "force-dynamic";
