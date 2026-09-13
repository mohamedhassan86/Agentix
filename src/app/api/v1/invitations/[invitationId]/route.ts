import { dispatchRoute } from "@/app/lib/route-dispatch";
import { PREVIEW_INVITATION_TYPE } from "@/application/identity/queries/preview-invitation";
import { ValidationError } from "@/application/shared/errors/app-error";

export async function GET(
  request: Request,
  { params }: { params: { invitationId: string } },
): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "previewInvitation",
    parse: async () => {
      const token = url.searchParams.get("token") ?? "";
      if (!token) throw new ValidationError("Validation failed", { token: ["Token is required"] });
      return { invitationId: params.invitationId, token };
    },
    handlerType: PREVIEW_INVITATION_TYPE,
    auth: "none",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
