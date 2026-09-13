import { dispatchRoute } from "@/app/lib/route-dispatch";
import { CHANGE_MEMBER_ROLE_TYPE } from "@/application/identity/commands/change-member-role";
import { REMOVE_MEMBER_TYPE } from "@/application/identity/commands/remove-member";
import { changeRoleRequestSchema } from "@/application/identity/dto/member";

export async function PATCH(
  request: Request,
  { params }: { params: { memberId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "changeMemberRole",
    parse: async (req) => ({
      memberId: params.memberId,
      ...changeRoleRequestSchema.parse(await req.json()),
    }),
    handlerType: CHANGE_MEMBER_ROLE_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { memberId: string } },
): Promise<Response> {
  return dispatchRoute({
    request,
    operation: "removeMember",
    parse: async () => ({ memberId: params.memberId }),
    handlerType: REMOVE_MEMBER_TYPE,
    auth: "required",
    successStatus: 204,
    emptyBody: true,
  });
}

export const dynamic = "force-dynamic";
