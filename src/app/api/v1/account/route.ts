import { dispatchRoute } from "@/app/lib/route-dispatch";
import { GET_CURRENT_ACCOUNT_TYPE } from "@/application/identity/queries/get-current-account";
import { DELETE_ACCOUNT_TYPE } from "@/application/identity/commands/delete-account";
import { deleteAccountRequestSchema } from "@/application/identity/dto/account";

export async function GET(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "getCurrentAccount",
    parse: async () => ({}),
    handlerType: GET_CURRENT_ACCOUNT_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function DELETE(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "deleteCurrentAccount",
    parse: async (req) => deleteAccountRequestSchema.parse(await req.json()),
    handlerType: DELETE_ACCOUNT_TYPE,
    auth: "required",
    successStatus: 204,
    emptyBody: true,
    clearSessionCookie: true,
  });
}

export const dynamic = "force-dynamic";
