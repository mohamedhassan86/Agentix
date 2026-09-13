import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const openApiRegistry = new OpenAPIRegistry();

// Shared schemas
export const HealthResponseSchema = openApiRegistry.register("HealthResponse", z.object({
  status: z.enum(["alive", "ready"]),
  service: z.literal("agentix-web"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
}));

export const PingResponseSchema = openApiRegistry.register("PingResponse", z.object({
  status: z.literal("ok"),
  service: z.literal("agentix"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
}));

export const ProblemSchema = openApiRegistry.register("Problem", z.object({
  type: z.string(),
  title: z.string().min(1),
  status: z.number().min(400).max(599),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,119}$/),
  correlationId: z.string().uuid(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  instance: z.string().optional(),
  dependency: z.enum(["database", "schema"]).optional(),
  reason: z.string().regex(/^[a-z][a-z0-9_]{2,63}$/).optional(),
}));

export const FoundationWorkResponseSchema = openApiRegistry.register("FoundationWorkResponse", z.object({
  requestId: z.string().uuid(),
  workId: z.string().uuid(),
  status: z.enum(["queued", "processing", "succeeded", "failed"]),
  attemptCount: z.number().int().min(0).max(10),
  effectCount: z.number().int().min(0).max(1),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  lastErrorCode: z.string().min(1).max(120).nullable().optional(),
}));

// Register paths for health and ping (foundation work path will be added in Phase 4)
openApiRegistry.registerPath({
  method: "get",
  path: "/health/live",
  tags: ["Health"],
  operationId: "getLiveness",
  responses: {
    200: {
      description: "Process can answer requests",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/health/ready",
  tags: ["Health"],
  operationId: "getReadiness",
  responses: {
    200: {
      description: "Ready",
      content: { "application/json": { schema: HealthResponseSchema } },
    },
    503: {
      description: "Not ready",
      content: { "application/problem+json": { schema: ProblemSchema } },
    },
  },
});

openApiRegistry.registerPath({
  method: "get",
  path: "/api/v1/ping",
  tags: ["Foundation"],
  operationId: "getPing",
  responses: {
    200: {
      description: "Foundation is responsive",
      content: { "application/json": { schema: PingResponseSchema } },
    },
  },
});

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
