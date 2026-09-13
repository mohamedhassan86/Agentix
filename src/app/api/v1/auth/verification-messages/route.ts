import { dispatchRoute } from "@/app/lib/route-dispatch";
import { RESEND_VERIFICATION_TYPE } from "@/application/identity/commands/resend-verification";

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "resendVerification",
    parse: async () => ({}),
    handlerType: RESEND_VERIFICATION_TYPE,
    auth: "required",
    successStatus: 202,
  });
}

export const dynamic = "force-dynamic";
