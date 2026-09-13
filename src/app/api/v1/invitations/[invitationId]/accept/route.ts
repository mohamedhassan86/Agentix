import { dispatchRoute } from "@/app/lib/route-dispatch";
import { ACCEPT_INVITATION_TYPE } from "@/application/identity/commands/accept-invitation";
import { z } from "zod";

const acceptBody = z.object({ token: z.string().min(40) });

export async function POST(
  request: Request,
  { params }: { params: { invitationId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "acceptInvitation",
    parse: async (req) => ({
      invitationId: params.invitationId,
      ...acceptBody.parse(await req.json()),
    }),
    handlerType: ACCEPT_INVITATION_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
