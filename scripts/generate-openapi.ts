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

const AccountSchema = registry.register("Account", z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  emailVerified: z.boolean(),
  platformAdministrator: z.boolean(),
  createdAt: z.string().datetime(),
}));

const RegisterRequestSchema = registry.register("RegisterRequest", z.object({
  email: z.string().email().max(254),
  displayName: z.string().min(1).max(120),
  password: z.string().min(8).max(1024),
}));

const RegisterResultSchema = registry.register("RegisterResult", z.object({
  account: AccountSchema,
  verificationMessageQueued: z.literal(true),
}));

const SignInRequestSchema = registry.register("SignInRequest", z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(1024),
}));

const SessionContextSchema = registry.register("SessionContext", z.object({
  userId: z.string().uuid(),
  activeOrganizationId: z.string().uuid().nullable(),
  activeRole: z.enum(["viewer", "member", "admin", "owner"]).nullable(),
  platformAdministrator: z.boolean(),
}));

const OneTimeTokenRequestSchema = registry.register("OneTimeTokenRequest", z.object({
  token: z.string().min(40),
}));

const VerificationResultSchema = registry.register("VerificationResult", z.object({
  status: z.enum(["verified", "already_verified"]),
}));

const MessageQueuedResultSchema = registry.register("MessageQueuedResult", z.object({
  queued: z.literal(true),
}));

const OrganizationProfileSchema = registry.register("OrganizationProfile", z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string().min(3).max(48),
  currentRole: z.enum(["viewer", "member", "admin", "owner"]).nullable(),
  createdAt: z.string().datetime(),
}));

const OrganizationPageSchema = registry.register("OrganizationPage", z.object({
  items: z.array(OrganizationProfileSchema),
  nextCursor: z.string().nullable(),
}));

const CreateOrganizationRequestSchema = registry.register("CreateOrganizationRequest", z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(3).max(48).optional(),
}));

const UpdateOrganizationRequestSchema = registry.register("UpdateOrganizationRequest", z.object({
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(3).max(48).optional(),
}));

const DeleteOrganizationRequestSchema = registry.register("DeleteOrganizationRequest", z.object({
  confirmationSlug: z.string().min(3).max(48),
}));

const SlugSuggestionSchema = registry.register("SlugSuggestion", z.object({
  slug: z.string().min(3).max(48),
}));

const InvitationSchema = registry.register("Invitation", z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["viewer", "member", "admin"]),
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  deliveryState: z.enum(["queued", "sent", "failed"]),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  ageSeconds: z.number().min(0),
}));

const InvitationPageSchema = registry.register("InvitationPage", z.object({
  items: z.array(InvitationSchema),
  nextCursor: z.string().nullable(),
}));

const CreateInvitationRequestSchema = registry.register("CreateInvitationRequest", z.object({
  email: z.string().email().max(254),
  role: z.enum(["viewer", "member", "admin"]),
}));

const InvitationPreviewSchema = registry.register("InvitationPreview", z.object({
  invitationId: z.string().uuid(),
  organizationName: z.string(),
  invitedEmail: z.string().email(),
  role: z.enum(["viewer", "member", "admin"]),
  status: z.enum(["pending", "accepted", "expired", "revoked"]),
  expiresAt: z.string().datetime(),
  accountRequired: z.boolean(),
}));

const InvitationAcceptanceResultSchema = registry.register("InvitationAcceptanceResult", z.object({
  membership: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    displayName: z.string(),
    email: z.string().email(),
    role: z.enum(["viewer", "member", "admin", "owner"]),
    joinedAt: z.string().datetime(),
  }),
  activeOrganizationChanged: z.literal(false),
}));

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/register",
  tags: ["Authentication"],
  operationId: "registerAccount",
  request: { body: { content: { "application/json": { schema: RegisterRequestSchema } } } },
  responses: {
    201: { description: "Registered", content: { "application/json": { schema: RegisterResultSchema } } },
    409: { description: "Registration failed", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/sign-in",
  tags: ["Authentication"],
  operationId: "signIn",
  request: { body: { content: { "application/json": { schema: SignInRequestSchema } } } },
  responses: {
    200: { description: "Signed in", content: { "application/json": { schema: SessionContextSchema } } },
    401: { description: "Authentication failed", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/sign-out",
  tags: ["Authentication"],
  operationId: "signOut",
  responses: {
    204: { description: "Signed out" },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/verify-email",
  tags: ["Authentication"],
  operationId: "verifyEmail",
  request: { body: { content: { "application/json": { schema: OneTimeTokenRequestSchema } } } },
  responses: {
    200: { description: "Verified", content: { "application/json": { schema: VerificationResultSchema } } },
    400: { description: "Token problem", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/auth/verification-messages",
  tags: ["Authentication"],
  operationId: "resendVerification",
  responses: {
    202: { description: "Queued", content: { "application/json": { schema: MessageQueuedResultSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Conflict", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/account",
  tags: ["Account"],
  operationId: "getCurrentAccount",
  responses: {
    200: { description: "Account", content: { "application/json": { schema: AccountSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/account",
  tags: ["Account"],
  operationId: "deleteCurrentAccount",
  responses: {
    204: { description: "Deleted" },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Owner invariant", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/session",
  tags: ["Session"],
  operationId: "getSessionContext",
  responses: {
    200: { description: "Session", content: { "application/json": { schema: SessionContextSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/organizations",
  tags: ["Organizations"],
  operationId: "listMyOrganizations",
  responses: {
    200: { description: "Memberships", content: { "application/json": { schema: OrganizationPageSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/organizations",
  tags: ["Organizations"],
  operationId: "createOrganization",
  request: { body: { content: { "application/json": { schema: CreateOrganizationRequestSchema } } } },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: OrganizationProfileSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Slug conflict", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/organizations/slug-suggestion",
  tags: ["Organizations"],
  operationId: "suggestOrganizationSlug",
  responses: {
    200: { description: "Suggestion", content: { "application/json": { schema: SlugSuggestionSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/organization",
  tags: ["Organizations"],
  operationId: "getActiveOrganization",
  responses: {
    200: { description: "Active organization", content: { "application/json": { schema: OrganizationProfileSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "No active organization", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/organization",
  tags: ["Organizations"],
  operationId: "updateActiveOrganization",
  request: { body: { content: { "application/json": { schema: UpdateOrganizationRequestSchema } } } },
  responses: {
    200: { description: "Updated", content: { "application/json": { schema: OrganizationProfileSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Slug conflict", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/organization",
  tags: ["Organizations"],
  operationId: "deleteActiveOrganization",
  request: { body: { content: { "application/json": { schema: DeleteOrganizationRequestSchema } } } },
  responses: {
    204: { description: "Deleted" },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/organization/invitations",
  tags: ["Invitations"],
  operationId: "listInvitations",
  responses: {
    200: { description: "Invitations", content: { "application/json": { schema: InvitationPageSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/organization/invitations",
  tags: ["Invitations"],
  operationId: "createInvitation",
  request: { body: { content: { "application/json": { schema: CreateInvitationRequestSchema } } } },
  responses: {
    201: { description: "Created", content: { "application/json": { schema: InvitationSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Invitation conflict", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/organization/invitations/{invitationId}/resend",
  tags: ["Invitations"],
  operationId: "resendInvitation",
  request: { params: z.object({ invitationId: z.string().uuid() }) },
  responses: {
    202: { description: "Queued", content: { "application/json": { schema: MessageQueuedResultSchema } } },
    409: { description: "Invitation state", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/organization/invitations/{invitationId}/revoke",
  tags: ["Invitations"],
  operationId: "revokeInvitation",
  request: { params: z.object({ invitationId: z.string().uuid() }) },
  responses: {
    200: { description: "Revoked", content: { "application/json": { schema: InvitationSchema } } },
    409: { description: "Invitation state", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/invitations/{invitationId}",
  tags: ["Invitations"],
  operationId: "previewInvitation",
  request: { params: z.object({ invitationId: z.string().uuid() }) },
  responses: {
    200: { description: "Preview", content: { "application/json": { schema: InvitationPreviewSchema } } },
    400: { description: "Token problem", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/organization/members",
  tags: ["Members"],
  operationId: "listActiveOrganizationMembers",
  responses: {
    200: { description: "Members", content: { "application/json": { schema: z.object({ items: z.array(z.any()), roleCounts: z.object({ viewer: z.number(), member: z.number(), admin: z.number(), owner: z.number() }), nextCursor: z.string().nullable() }) } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/organization/members/{memberId}",
  tags: ["Members"],
  operationId: "changeMemberRole",
  request: {
    params: z.object({ memberId: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ role: z.enum(["viewer", "member", "admin"]) }) } } },
  },
  responses: {
    200: { description: "Updated" },
    403: { description: "Permission denied", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Owner invariant", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/organization/members/{memberId}",
  tags: ["Members"],
  operationId: "removeMember",
  request: { params: z.object({ memberId: z.string().uuid() }) },
  responses: {
    204: { description: "Removed" },
    409: { description: "Owner invariant", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/organization/membership",
  tags: ["Members"],
  operationId: "leaveActiveOrganization",
  responses: {
    204: { description: "Left" },
    409: { description: "Owner invariant", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/api/v1/organization/ownership",
  tags: ["Members"],
  operationId: "transferOwnership",
  request: { body: { content: { "application/json": { schema: z.object({ targetMemberId: z.string().uuid(), confirmation: z.literal("TRANSFER") }) } } } },
  responses: {
    200: { description: "Transferred" },
    409: { description: "Owner invariant", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/invitations/{invitationId}/accept",
  tags: ["Invitations"],
  operationId: "acceptInvitation",
  request: {
    params: z.object({ invitationId: z.string().uuid() }),
    body: { content: { "application/json": { schema: z.object({ token: z.string().min(40) }) } } },
  },
  responses: {
    200: { description: "Accepted", content: { "application/json": { schema: InvitationAcceptanceResultSchema } } },
    401: { description: "Authentication required", content: { "application/problem+json": { schema: ProblemSchema } } },
    403: { description: "Email mismatch", content: { "application/problem+json": { schema: ProblemSchema } } },
    409: { description: "Invitation state", content: { "application/problem+json": { schema: ProblemSchema } } },
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

const doc = generator.generateDocument({
  openapi: "3.1.0",
  info: {
    title: "Agentix API",
    version: "0.2.0",
    description: "Foundation plus tenancy and identity contracts.",
  },
  servers: [{ url: "/" }],
  tags: [
    { name: "Health", description: "Process liveness and dependency readiness." },
    { name: "Foundation", description: "Versioned ping and non-business foundation validation operations." },
    { name: "Authentication", description: "Register, sign-in, verification." },
    { name: "Account", description: "Current account." },
    { name: "Session", description: "Session context and organization switch." },
    { name: "Organizations", description: "Create, list, and manage the active organization." },
    { name: "Invitations", description: "Invite teammates and accept membership." },
    { name: "Members", description: "Roles, leave, remove, and ownership transfer." },
  ],
});

writeFileSync(OUT_FILE, JSON.stringify(doc, null, 2));
console.log(`OpenAPI generated at ${OUT_FILE}`);
