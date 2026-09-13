import { dispatchRoute } from "@/app/lib/route-dispatch";
import { SIGN_IN_TYPE } from "@/application/identity/commands/sign-in";
import { signInRequestSchema } from "@/application/identity/dto/sign-in";

export async function POST(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "signIn",
    parse: async (req) => signInRequestSchema.parse(await req.json()),
    handlerType: SIGN_IN_TYPE,
    auth: "none",
    successStatus: 200,
    sessionCookie: true,
  });
}

export const dynamic = "force-dynamic";
