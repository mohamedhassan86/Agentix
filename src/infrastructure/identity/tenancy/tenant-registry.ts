/**
 * Tenant registry - lists every tenant-scoped model
 * Used to ensure all tenant models are covered by scoped client
 */

export const TENANT_SCOPED_MODELS = [
  "membership",
  "invitation",
  "organization", // organization is tenant-owned but also has global unique slug; still considered tenant-scoped for writes
  "oneTimeToken", // invitation tokens are org-scoped
  "session", // active_org_id is convenience but still scoped for invalidation
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

// Models that are NOT tenant-scoped (global)
export const GLOBAL_MODELS = [
  "user",
  "loginThrottle",
  "identityEvent",
  "outboxMessage",
  "outboxAttempt",
  "foundationDemoRequest",
  "foundationDemoEffect",
] as const;

export function assertTenantModelRegistered(model: string): void {
  if (!(TENANT_SCOPED_MODELS as readonly string[]).includes(model)) {
    throw new Error(`Model ${model} is not registered as tenant-scoped. Add it to TENANT_SCOPED_MODELS or use global client.`);
  }
}

export function isTenantScopedModel(model: string): boolean {
  return (TENANT_SCOPED_MODELS as readonly string[]).includes(model);
}
