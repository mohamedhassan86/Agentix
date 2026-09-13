import type { Invitation } from "@/domain/identity/entities/invitation";
import type { Invitation as InvitationDto } from "../dto/invitation";

export function toInvitationDto(invitation: Invitation, now: Date): InvitationDto {
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - invitation.createdAt.getTime()) / 1000));
  return {
    id: invitation.id,
    email: invitation.emailNormalized,
    role: invitation.role,
    status: invitation.getEffectiveStatus(now),
    deliveryState: invitation.deliveryState,
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    ageSeconds,
  };
}
