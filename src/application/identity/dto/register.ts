import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(1024),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const accountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  platformAdministrator: z.boolean(),
  createdAt: z.string().datetime(),
});

export const registerResultSchema = z.object({
  account: accountSchema,
  verificationMessageQueued: z.literal(true),
});

export type RegisterResult = z.infer<typeof registerResultSchema>;
