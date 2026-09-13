import { dispatchRoute } from "@/app/lib/route-dispatch";
import { VERIFY_EMAIL_TYPE } from "@/application/identity/commands/verify-email";
import { oneTimeTokenRequestSchema } from "@/application/identity/dto/verification";

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "verifyEmail",
    parse: async (req) => oneTimeTokenRequestSchema.parse(await req.json()),
    handlerType: VERIFY_EMAIL_TYPE,
    auth: "none",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
