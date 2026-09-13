import { z } from "zod";

export const roleSchema = z.enum(["viewer", "member", "admin", "owner"]);
export const invitableRoleSchema = z.enum(["viewer", "member", "admin"]);

export const memberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  displayName: z.string(),
  email: z.string().email(),
  role: roleSchema,
  joinedAt: z.string().datetime(),
});

export type Member = z.infer<typeof memberSchema>;

export const memberPageSchema = z.object({
  items: z.array(memberSchema),
  roleCounts: z.object({
    viewer: z.number().min(0),
    member: z.number().min(0),
    admin: z.number().min(0),
    owner: z.number().refine((v) => v === 1, { message: "Owner must be exactly 1" }),
  }),
  nextCursor: z.string().nullable(),
});

export type MemberPage = z.infer<typeof memberPageSchema>;

export const changeRoleRequestSchema = z.object({
  role: invitableRoleSchema,
});

export type ChangeRoleRequest = z.infer<typeof changeRoleRequestSchema>;

export const transferOwnershipRequestSchema = z.object({
  targetMemberId: z.string().uuid(),
  confirmation: z.literal("TRANSFER"),
});

export type TransferOwnershipRequest = z.infer<typeof transferOwnershipRequestSchema>;

export const ownershipTransferResultSchema = z.object({
  owner: memberSchema,
  formerOwner: memberSchema,
});

export type OwnershipTransferResult = z.infer<typeof ownershipTransferResultSchema>;
