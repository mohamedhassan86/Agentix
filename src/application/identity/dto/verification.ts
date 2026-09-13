import { z } from "zod";

export const oneTimeTokenRequestSchema = z.object({
  token: z.string().min(40),
});

export type OneTimeTokenRequest = z.infer<typeof oneTimeTokenRequestSchema>;

export const verificationResultSchema = z.object({
  status: z.enum(["verified", "already_verified"]),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

export const messageQueuedResultSchema = z.object({
  queued: z.literal(true),
});

export type MessageQueuedResult = z.infer<typeof messageQueuedResultSchema>;
