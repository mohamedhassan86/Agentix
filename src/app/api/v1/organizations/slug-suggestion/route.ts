import { dispatchRoute } from "@/app/lib/route-dispatch";
import { SUGGEST_SLUG_TYPE } from "@/application/identity/queries/suggest-slug";
import { ValidationError } from "@/application/shared/errors/app-error";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  return dispatchRoute({
    request,
    operation: "suggestOrganizationSlug",
    parse: async () => {
      const name = url.searchParams.get("name") ?? "";
      if (!name.trim()) throw new ValidationError("Validation failed", { name: ["Name is required"] });
      return { name };
    },
    handlerType: SUGGEST_SLUG_TYPE,
    auth: "required",
    successStatus: 200,
  });
}

export const dynamic = "force-dynamic";
