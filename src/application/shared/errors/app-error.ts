import { ErrorCodes, type ErrorCode } from "./error-codes";

export interface AppErrorOptions {
  code?: ErrorCode;
  detail?: string;
  status?: number;
  title?: string;
  errors?: Record<string, string[]>;
  cause?: unknown;
  dependency?: "database" | "schema";
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly errors?: Record<string, string[]>;
  public readonly isOperational: boolean = true;
  public readonly dependency?: "database" | "schema";

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? ErrorCodes.UNEXPECTED_FAILURE;
    this.status = options.status ?? 500;
    this.title = options.title ?? "An error occurred";
    this.detail = options.detail ?? message;
    this.errors = options.errors;
    this.dependency = options.dependency;
    if (options.cause) {
      (this as any).cause = options.cause;
    }
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: Record<string, string[]> | string, detail?: string) {
    const errObj = typeof errors === "string" ? undefined : errors;
    const detailMsg = typeof errors === "string" ? errors : detail ?? message;
    super(message, {
      code: ErrorCodes.VALIDATION_FAILED,
      status: 400,
      title: "Validation failed",
      detail: detailMsg,
      errors: errObj,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.NOT_FOUND) {
    super(message, {
      code,
      status: 404,
      title: "Not found",
      detail: message,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.CONFLICT) {
    super(message, {
      code,
      status: 409,
      title: "Conflict",
      detail: message,
    });
  }
}

export class DomainRuleError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.DOMAIN_RULE_VIOLATION) {
    super(message, {
      code,
      status: 422,
      title: "Domain rule violation",
      detail: message,
    });
  }
}

export class UnavailableError extends AppError {
  constructor(message: string, dependency?: "database" | "schema", code: ErrorCode = ErrorCodes.UNAVAILABLE, status = 503) {
    super(message, {
      code,
      status,
      title: "Service unavailable",
      detail: message,
      dependency: dependency ?? "database",
    });
  }
}

export class UnexpectedError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.UNEXPECTED_FAILURE) {
    super(message, {
      code,
      status: 500,
      title: "Internal server error",
      detail: "An unexpected error occurred",
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Invalid email or password", code: ErrorCode = ErrorCodes.AUTHENTICATION_FAILED) {
    super(message, {
      code,
      status: 401,
      title: "Authentication failed",
      detail: message,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Permission denied", code: ErrorCode = ErrorCodes.PERMISSION_DENIED) {
    super(message, {
      code,
      status: 403,
      title: "Permission denied",
      detail: message,
    });
  }
}
