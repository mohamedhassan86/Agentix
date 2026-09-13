import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import { IdentityDomainError, IDENTITY_ERROR_CODES } from "@/domain/identity/errors/identity-errors";

const TITLE_BY_CODE: Record<string, string> = {
  [IDENTITY_ERROR_CODES.AUTHENTICATION_FAILED]: "Authentication failed",
  [IDENTITY_ERROR_CODES.REGISTRATION_FAILED]: "Registration failed",
  [IDENTITY_ERROR_CODES.ORGANIZATION_NOT_FOUND]: "Not found",
  [IDENTITY_ERROR_CODES.FORMER_MEMBER]: "No access",
  [IDENTITY_ERROR_CODES.NO_ACTIVE_ORGANIZATION]: "No active organization",
  [IDENTITY_ERROR_CODES.PERMISSION_DENIED]: "Permission denied",
  [IDENTITY_ERROR_CODES.SLUG_CONFLICT]: "Slug conflict",
  [IDENTITY_ERROR_CODES.INVITATION_CONFLICT]: "Invitation conflict",
  [IDENTITY_ERROR_CODES.INVITATION_STATE]: "Invitation state",
  [IDENTITY_ERROR_CODES.INVITATION_EMAIL_MISMATCH]: "Invitation email mismatch",
  [IDENTITY_ERROR_CODES.TOKEN_INVALID]: "Invalid token",
  [IDENTITY_ERROR_CODES.TOKEN_EXPIRED]: "Invalid token",
  [IDENTITY_ERROR_CODES.TOKEN_REVOKED]: "Invalid token",
  [IDENTITY_ERROR_CODES.TOKEN_CONSUMED]: "Invalid token",
  [IDENTITY_ERROR_CODES.OWNER_INVARIANT]: "Owner invariant",
  [IDENTITY_ERROR_CODES.ACCOUNT_DELETE_BLOCKED]: "Account delete blocked",
};

export function identityAppError(error: IdentityDomainError): AppError {
  return new AppError(error.message, {
    code: error.code as never,
    status: error.status,
    title: TITLE_BY_CODE[error.code] ?? error.message,
    detail: error.message,
  });
}

export function fromDomainMessage(message: string): AppError | null {
  switch (message) {
    case "ACCOUNT_DELETED":
    case "SESSION_INVALID":
      return new UnauthorizedError("Invalid email or password", ErrorCodes.AUTHENTICATION_FAILED);
    case "TOKEN_EXPIRED":
    case "TOKEN_REVOKED":
    case "TOKEN_ALREADY_CONSUMED":
    case "TOKEN_INVALID":
    case "TOKEN_INVALID_FORMAT":
      return new AppError("Invalid token", {
        code: ErrorCodes.TOKEN_INVALID,
        status: 400,
        title: "Invalid token",
        detail: "Invalid token",
      });
    case "OWNER_CANNOT_LEAVE_OR_BE_REMOVED":
    case "OWNER_ROLE_CANNOT_BE_CHANGED_VIA_GENERAL":
    case "OWNER_ROLE_MUST_USE_TRANSFER":
    case "OWNER_INVARIANT":
      return new ConflictError("Operation would violate Owner invariant", ErrorCodes.OWNER_INVARIANT);
    case "CANNOT_INVITE_AS_OWNER":
      return new ConflictError("Invitation conflict", ErrorCodes.INVITATION_CONFLICT);
    case "INVITATION_EXPIRED":
    case "INVITATION_REVOKED":
    case "INVITATION_ALREADY_ACCEPTED":
    case "INVITATION_NOT_ACCEPTABLE":
    case "INVITATION_CANNOT_RESEND":
    case "INVITATION_CANNOT_REVOKE":
    case "INVITATION_NOT_PENDING":
      return new ConflictError("Invitation state does not permit this operation", ErrorCodes.INVITATION_STATE);
    case "ORGANIZATION_DELETED":
    case "ORGANIZATION_ALREADY_DELETED":
      return new NotFoundError("Organization not found", ErrorCodes.ORGANIZATION_NOT_FOUND);
    case "CONFIRMATION_SLUG_MISMATCH":
      return new ValidationError("Confirmation slug does not match");
    case "PERMISSION_DENIED":
      return new ForbiddenError();
    case "SLUG_CONFLICT":
      return new ConflictError("Organization slug is already taken", ErrorCodes.SLUG_CONFLICT);
    case "SLUG_INVALID":
    case "SLUG_TOO_SHORT":
    case "SLUG_TOO_LONG":
    case "SLUG_INVALID_FORMAT":
    case "NAME_REQUIRED_FOR_SLUG":
    case "ORGANIZATION_NAME_REQUIRED":
    case "ORGANIZATION_NAME_TOO_LONG":
      return new ValidationError("Validation failed");
    case "PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS":
      return new ConflictError("Platform administrator must have zero memberships", ErrorCodes.OWNER_INVARIANT);
    default:
      return null;
  }
}

export function rethrowIdentity(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (error instanceof IdentityDomainError) throw identityAppError(error);
  if (error instanceof Error) {
    const mapped = fromDomainMessage(error.message);
    if (mapped) throw mapped;
  }
  throw error;
}

export function requireActor(actor: { userId: string } | null | undefined): asserts actor is { userId: string } {
  if (!actor) {
    throw new UnauthorizedError("Authentication required", ErrorCodes.AUTHENTICATION_FAILED);
  }
}
