import { z } from "zod";

export const configSchema = z.object({
  databaseUrl: z.string().min(1, "DATABASE_URL is required"),
  app: z.object({
    origin: z.string().optional(),
    corsOrigins: z.array(z.string().url()).default([]),
  }),
  worker: z.object({
    pollIntervalMs: z.number().int().min(100).max(10000).default(1000),
    batchSize: z.number().int().min(1).max(100).default(10),
    leaseSeconds: z.number().int().min(5).max(300).default(30),
    maxAttempts: z.number().int().min(1).max(10).default(3),
    shutdownSeconds: z.number().int().min(5).max(120).default(30),
  }),
  foundation: z.object({
    demoEnabled: z.boolean().default(false),
  }),
  log: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  }),
  otel: z.object({
    tracesUrl: z.string().optional(),
    metricsUrl: z.string().optional(),
  }),
});

export type RawConfig = z.input<typeof configSchema>;
export type ValidatedConfig = z.output<typeof configSchema>;

export function parseCorsOrigins(input?: string): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((origin) => {
      try {
        const url = new URL(origin);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error(`Invalid CORS origin protocol: ${origin}`);
        }
        // Exact origin, no path
        if (url.pathname !== "/" && url.pathname !== "") {
          // Allow but strip path? For exact-origin, we require no path
          throw new Error(`CORS origin must not include path: ${origin}`);
        }
        return url.origin;
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }
    });
}
