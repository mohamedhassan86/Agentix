import { z } from "zod";

export const problemSchema = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,119}$/),
  correlationId: z.string().uuid(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type Problem = z.infer<typeof problemSchema>;
