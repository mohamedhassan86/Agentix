import { z } from "zod";

export const organizationSlugSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/);

export const createOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(120),
  slug: organizationSlugSchema.optional(),
});

export type CreateOrganizationRequest = z.infer<typeof createOrganizationRequestSchema>;

export const updateOrganizationRequestSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    slug: organizationSlugSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.slug !== undefined, {
    message: "At least one of name or slug must be provided",
  });

export type UpdateOrganizationRequest = z.infer<typeof updateOrganizationRequestSchema>;

export const deleteOrganizationRequestSchema = z.object({
  confirmationSlug: organizationSlugSchema,
});

export type DeleteOrganizationRequest = z.infer<typeof deleteOrganizationRequestSchema>;

export const roleSchema = z.enum(["viewer", "member", "admin", "owner"]);

export const organizationProfileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: organizationSlugSchema,
  currentRole: roleSchema.nullable().describe("Null only on platform inspection"),
  createdAt: z.string().datetime(),
});

export type OrganizationProfile = z.infer<typeof organizationProfileSchema>;

export const organizationPageSchema = z.object({
  items: z.array(organizationProfileSchema),
  nextCursor: z.string().nullable(),
});

export type OrganizationPage = z.infer<typeof organizationPageSchema>;
