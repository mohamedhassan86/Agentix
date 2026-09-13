import { z } from "zod";

export const signInRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(1024),
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export const roleSchema = z.enum(["viewer", "member", "admin", "owner"]);

export const sessionContextSchema = z.object({
  userId: z.string().uuid(),
  activeOrganizationId: z.string().uuid().nullable(),
  activeRole: roleSchema.nullable(),
  platformAdministrator: z.boolean(),
});

export type SessionContext = z.infer<typeof sessionContextSchema>;
