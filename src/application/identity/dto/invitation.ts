import { z } from "zod";

export const invitableRoleSchema = z.enum(["viewer", "member", "admin"]);
export const invitationStatusSchema = z.enum(["pending", "accepted", "expired", "revoked"]);
export const deliveryStateSchema = z.enum(["queued", "sent", "failed"]);

export const createInvitationRequestSchema = z.object({
  email: z.string().email().max(254),
  role: invitableRoleSchema,
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const invitationSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: invitableRoleSchema,
  status: invitationStatusSchema,
  deliveryState: deliveryStateSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  ageSeconds: z.number().min(0),
});

export type Invitation = z.infer<typeof invitationSchema>;

export const invitationPageSchema = z.object({
  items: z.array(invitationSchema),
  nextCursor: z.string().nullable(),
});

export type InvitationPage = z.infer<typeof invitationPageSchema>;

export const invitationPreviewSchema = z.object({
  invitationId: z.string().uuid(),
  organizationName: z.string(),
  invitedEmail: z.string().email(),
  role: invitableRoleSchema,
  status: invitationStatusSchema,
  expiresAt: z.string().datetime(),
  accountRequired: z.boolean(),
});

export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;

export const invitationAcceptanceResultSchema = z.object({
  membership: z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    displayName: z.string(),
    email: z.string().email(),
    role: z.enum(["viewer", "member", "admin", "owner"]),
    joinedAt: z.string().datetime(),
  }),
  activeOrganizationChanged: z.literal(false),
});

export type InvitationAcceptanceResult = z.infer<typeof invitationAcceptanceResultSchema>;
