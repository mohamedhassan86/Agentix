import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  platformAdministrator: z.boolean(),
  createdAt: z.string().datetime(),
});

export type Account = z.infer<typeof accountSchema>;

export const deleteAccountRequestSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export type DeleteAccountRequest = z.infer<typeof deleteAccountRequestSchema>;
