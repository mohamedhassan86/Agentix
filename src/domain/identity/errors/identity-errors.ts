/**
 * Identity domain errors with stable codes per RFC 9457
 * Code regex: ^[A-Z][A-Z0-9_]{1,119}$
 */

export const IDENTITY_ERROR_CODES = {
  AUTHENTICATION_FAILED: "AUTHENTICATION_FAILED",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
  ORGANIZATION_NOT_FOUND: "ORGANIZATION_NOT_FOUND",
  FORMER_MEMBER: "FORMER_MEMBER",
  NO_ACTIVE_ORGANIZATION: "NO_ACTIVE_ORGANIZATION",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SLUG_CONFLICT: "SLUG_CONFLICT",
  INVITATION_CONFLICT: "INVITATION_CONFLICT",
  INVITATION_STATE: "INVITATION_STATE",
  INVITATION_EMAIL_MISMATCH: "INVITATION_EMAIL_MISMATCH",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TOKEN_CONSUMED: "TOKEN_CONSUMED",
  OWNER_INVARIANT: "OWNER_INVARIANT",
  ACCOUNT_DELETE_BLOCKED: "ACCOUNT_DELETE_BLOCKED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  CONFLICT: "CONFLICT",
  EMAIL_INVALID: "EMAIL_INVALID",
  PASSWORD_TOO_SHORT: "PASSWORD_TOO_SHORT",
  DISPLAY_NAME_REQUIRED: "DISPLAY_NAME_REQUIRED",
  ORGANIZATION_NAME_REQUIRED: "ORGANIZATION_NAME_REQUIRED",
  SLUG_INVALID: "SLUG_INVALID",
  ROLE_NOT_INVITABLE: "ROLE_NOT_INVITABLE",
  PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS: "PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS",
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
  ORGANIZATION_DELETED: "ORGANIZATION_DELETED",
  SESSION_INVALID: "SESSION_INVALID",
  THROTTLED: "THROTTLED",
} as const;

export type IdentityErrorCode = (typeof IDENTITY_ERROR_CODES)[keyof typeof IDENTITY_ERROR_CODES];

export class IdentityDomainError extends Error {
  readonly code: IdentityErrorCode;
  readonly status: number;

  constructor(code: IdentityErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "IdentityDomainError";
  }
}

export class AuthenticationFailedError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.AUTHENTICATION_FAILED, "Invalid email or password", 401);
  }
}

export class RegistrationFailedError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.REGISTRATION_FAILED, "Registration failed", 409);
  }
}

export class OrganizationNotFoundError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.ORGANIZATION_NOT_FOUND, "Organization not found", 404);
  }
}

export class FormerMemberError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.FORMER_MEMBER, "No access to this organization", 403);
  }
}

export class NoActiveOrganizationError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.NO_ACTIVE_ORGANIZATION, "No active organization", 403);
  }
}

export class PermissionDeniedError extends IdentityDomainError {
  constructor(message = "Permission denied") {
    super(IDENTITY_ERROR_CODES.PERMISSION_DENIED, message, 403);
  }
}

export class SlugConflictError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.SLUG_CONFLICT, "Organization slug is already taken", 409);
  }
}

export class InvitationConflictError extends IdentityDomainError {
  constructor(message = "Invitation conflict") {
    super(IDENTITY_ERROR_CODES.INVITATION_CONFLICT, message, 409);
  }
}

export class InvitationStateError extends IdentityDomainError {
  constructor(message = "Invitation state does not permit this operation") {
    super(IDENTITY_ERROR_CODES.INVITATION_STATE, message, 409);
  }
}

export class InvitationEmailMismatchError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.INVITATION_EMAIL_MISMATCH, "Signed-in email does not match invitation", 403);
  }
}

export class TokenInvalidError extends IdentityDomainError {
  constructor(message = "Invalid token") {
    super(IDENTITY_ERROR_CODES.TOKEN_INVALID, message, 400);
  }
}

export class OwnerInvariantError extends IdentityDomainError {
  constructor(message = "Operation would violate Owner invariant") {
    super(IDENTITY_ERROR_CODES.OWNER_INVARIANT, message, 409);
  }
}

export class AccountDeleteBlockedError extends IdentityDomainError {
  constructor() {
    super(IDENTITY_ERROR_CODES.ACCOUNT_DELETE_BLOCKED, "Cannot delete account while sole Owner of an organization", 409);
  }
}
