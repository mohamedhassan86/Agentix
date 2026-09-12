/**
 * Generate OpenAPI 3.1 JSON from Zod schemas registered in openapi-registry.
 * Commits to contracts/openapi/agentix-v1.json and is checked by openapi:check.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "contracts/openapi");
const OUT_FILE = join(OUT_DIR, "agentix-v1.json");

console.log("Generating OpenAPI from Zod schemas...");

if (!existsSync(OUT_DIR)) {
  mkdirSync(OUT_DIR, { recursive: true });
}

const registry = new OpenAPIRegistry();

// Define schemas matching spec
const HealthResponseSchema = registry.register("HealthResponse", z.object({
  status: z.enum(["alive", "ready"]),
  service: z.literal("agentix-web"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
}));

const PingResponseSchema = registry.register("PingResponse", z.object({
  status: z.literal("ok"),
  service: z.literal("agentix"),
  version: z.string().min(1).max(50),
  time: z.string().datetime(),
}));

const FoundationWorkStatusSchema = registry.register("FoundationWorkStatus", z.enum(["queued", "processing", "succeeded", "failed"]));

const FoundationWorkResponseSchema = registry.register("FoundationWorkResponse", z.object({
  requestId: z.string().uuid(),
  workId: z.string().uuid(),
  status: FoundationWorkStatusSchema,
  attemptCount: z.number().int().min(0).max(10),
  effectCount: z.number().int().min(0).max(1),
  requestedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable().optional(),
  lastErrorCode: z.string().min(1).max(120).nullable().optional(),
}));

const ProblemSchema = registry.register("Problem", z.object({
  type: z.string(),
  title: z.string().min(1),
  status: z.number().min(400).max(599),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{1,119}$/),
  correlationId: z.string().uuid(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
  instance: z.string().optional(),
  dependency: z.enum(["database", "schema"]).optional(),
}));

const ReadinessProblemSchema = registry.register("ReadinessProblem", ProblemSchema.extend({
  dependency: z.enum(["database", "schema"]),
}));

// Headers
registry.registerComponent("headers", "XCorrelationId", {
  name: "X-Correlation-Id",
  description: "Canonical request correlation UUID",
  schema: z.string().uuid(),
} as any);

registry.registerComponent("headers", "NoStore", {
  name: "Cache-Control",
  description: "Health/status output is not cached",
  schema: z.literal("no-store"),
} as any);

// Paths
registry.registerPath({
  method: "get",
  path: "/health/live",
  tags: ["Health"],
  operationId: "getLiveness",
  summary: "Check web-process liveness",
  responses: {
    200: {
      description: "Process can answer requests",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        "Cache-Control": { $ref: "#/components/headers/NoStore" },
      },
      content: {
        "application/json": { schema: HealthResponseSchema },
      },
    },
    403: {
      description: "Origin not allowed",
      content: { "application/problem+json": { schema: ProblemSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/health/ready",
  tags: ["Health"],
  operationId: "getReadiness",
  summary: "Check required dependency readiness",
  responses: {
    200: {
      description: "Required database and schema are ready",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        "Cache-Control": { $ref: "#/components/headers/NoStore" },
      },
      content: {
        "application/json": { schema: HealthResponseSchema },
      },
    },
    503: {
      description: "A required dependency category is unavailable",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        "Cache-Control": { $ref: "#/components/headers/NoStore" },
      },
      content: {
        "application/problem+json": { schema: ReadinessProblemSchema },
      },
    },
    403: {
      description: "Origin not allowed",
      content: { "application/problem+json": { schema: ProblemSchema } },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/ping",
  tags: ["Foundation"],
  operationId: "getPing",
  summary: "Exercise versioned query dispatch",
  responses: {
    200: {
      description: "Foundation is responsive",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        "Cache-Control": { $ref: "#/components/headers/NoStore" },
      },
      content: {
        "application/json": { schema: PingResponseSchema },
      },
    },
    403: {
      description: "Origin not allowed",
      content: { "application/problem+json": { schema: ProblemSchema } },
    },
    500: {
      description: "Unexpected",
      content: { "application/problem+json": { schema: ProblemSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/foundation/work",
  tags: ["Foundation"],
  operationId: "createFoundationWork",
  summary: "Enqueue non-business demonstration work atomically",
  request: {
    headers: z.object({
      "Idempotency-Key": z.string().min(1).max(200).optional(),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({}).strict().optional(),
        },
      },
    },
  },
  responses: {
    202: {
      description: "First request created and work queued",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        Location: { description: "Same-origin status resource", schema: { type: "string" } },
      },
      content: {
        "application/json": { schema: FoundationWorkResponseSchema },
      },
    },
    200: {
      description: "Existing request returned for repeated key",
      content: {
        "application/json": { schema: FoundationWorkResponseSchema },
      },
    },
    400: { description: "Validation", content: { "application/problem+json": { schema: ProblemSchema } } },
    404: { description: "Not found / disabled", content: { "application/problem+json": { schema: ProblemSchema } } },
    503: { description: "Unavailable", content: { "application/problem+json": { schema: ProblemSchema } } },
    500: { description: "Unexpected", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/foundation/work/{requestId}",
  tags: ["Foundation"],
  operationId: "getFoundationWork",
  summary: "Read demonstration work status",
  request: {
    params: z.object({
      requestId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "Current safe work projection",
      headers: {
        "X-Correlation-Id": { $ref: "#/components/headers/XCorrelationId" },
        "Cache-Control": { $ref: "#/components/headers/NoStore" },
      },
      content: {
        "application/json": { schema: FoundationWorkResponseSchema },
      },
    },
    400: { description: "Validation", content: { "application/problem+json": { schema: ProblemSchema } } },
    404: { description: "Not found", content: { "application/problem+json": { schema: ProblemSchema } } },
    500: { description: "Unexpected", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Agentix Foundation API",
    version: "0.1.0",
    description: "Foundation-only contract for health, versioned ping, and non-business demonstration work.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health", description: "Process liveness and dependency readiness." },
    { name: "Foundation", description: "Versioned ping and non-business foundation validation operations." },
  ],
});

writeFileSync(OUT_FILE, JSON.stringify(doc, null, 2));
console.log(`OpenAPI generated at ${OUT_FILE}`);
