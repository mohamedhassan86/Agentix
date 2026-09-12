import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

export const openApiRegistry = new OpenAPIRegistry();

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Agentix Foundation API",
      version: "0.1.0",
      description: "Foundation-only contract for health, ping, and demo work",
    },
    servers: [{ url: "/" }],
  });
}

// Placeholder schemas for Phase 2
export const HealthResponseSchema = z.object({
  status: z.enum(["alive", "ready"]),
  service: z.literal("agentix-web"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
});

export const PingResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("agentix"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
});

export const ProblemSchema = z.object({
  type: z.string().url().or(z.literal("about:blank")),
  title: z.string().min(1),
  status: z.number().min(400).max(599),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,119}$/),
  correlationId: z.string().uuid(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  instance: z.string().optional(),
});

export const FoundationWorkResponseSchema = z.object({
  requestId: z.string().uuid(),
  workId: z.string().uuid(),
  status: z.enum(["queued", "processing", "succeeded", "failed"]),
  attemptCount: z.number().int().min(0).max(10),
  effectCount: z.number().int().min(0).max(1),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  lastErrorCode: z.string().min(1).max(120).nullable().optional(),
});
