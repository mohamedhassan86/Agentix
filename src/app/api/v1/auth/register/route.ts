import { dispatchRoute } from "@/app/lib/route-dispatch";
import { REGISTER_ACCOUNT_TYPE } from "@/application/identity/commands/register-account";
import { registerRequestSchema } from "@/application/identity/dto/register";

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "registerAccount",
    parse: async (req) => registerRequestSchema.parse(await req.json()),
    handlerType: REGISTER_ACCOUNT_TYPE,
    auth: "none",
    successStatus: 201,
  });
}

export const dynamic = "force-dynamic";
