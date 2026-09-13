import { dispatchRoute } from "@/app/lib/route-dispatch";
import { TRANSFER_OWNERSHIP_TYPE } from "@/application/identity/commands/transfer-ownership";
import { transferOwnershipRequestSchema } from "@/application/identity/dto/member";

export async function PUT(request: Request): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "transferOwnership",
    parse: async (req) => transferOwnershipRequestSchema.parse(await req.json()),
    handlerType: TRANSFER_OWNERSHIP_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
