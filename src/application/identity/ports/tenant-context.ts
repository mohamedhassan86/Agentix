/**
 * ITenantContext closed modes: UnscopedIdentity, Member(orgId,userId), PlatformInspect(userId)
 */

export type TenantContextMode = "UnscopedIdentity" | "Member" | "PlatformInspect";

export interface UnscopedIdentityContext {
  mode: "UnscopedIdentity";
  userId: string;
  isPlatformAdmin: boolean;
}

export interface MemberContext {
  mode: "Member";
  userId: string;
  orgId: string;
  role: "viewer" | "member" | "admin" | "owner";
  isPlatformAdmin: false;
}

export interface PlatformInspectContext {
  mode: "PlatformInspect";
  userId: string;
  isPlatformAdmin: true;
}

export type ITenantContext = UnscopedIdentityContext | MemberContext | PlatformInspectContext;

export function isMemberContext(ctx: ITenantContext): ctx is MemberContext {
  return ctx.mode === "Member";
}

export function isPlatformInspectContext(ctx: ITenantContext): ctx is PlatformInspectContext {
  return ctx.mode === "PlatformInspect";
}

export function isUnscopedContext(ctx: ITenantContext): ctx is UnscopedIdentityContext {
  return ctx.mode === "UnscopedIdentity";
}

export function requireMemberContext(ctx: ITenantContext): MemberContext {
  if (!isMemberContext(ctx)) {
    throw new Error("MEMBER_CONTEXT_REQUIRED");
  }
  return ctx;
}

export function requirePlatformInspectContext(ctx: ITenantContext): PlatformInspectContext {
  if (!isPlatformInspectContext(ctx)) {
    throw new Error("PLATFORM_INSPECT_CONTEXT_REQUIRED");
  }
  return ctx;
}
