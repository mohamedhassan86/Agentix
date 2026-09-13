import { z } from "zod";

// Platform inspection reuses organization/member/invitation schemas but read-only
export const organizationIdParamSchema = z.object({
  organizationId: z.string().uuid(),
});

export type OrganizationIdParam = z.infer<typeof organizationIdParamSchema>;
