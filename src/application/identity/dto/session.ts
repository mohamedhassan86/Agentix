import { z } from "zod";

export const switchOrganizationRequestSchema = z.object({
  organizationId: z.string().uuid(),
});

export type SwitchOrganizationRequest = z.infer<typeof switchOrganizationRequestSchema>;
