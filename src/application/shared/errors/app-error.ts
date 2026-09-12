import { ErrorCodes, type ErrorCode } from "./error-codes";

export interface AppErrorOptions {
  code?: ErrorCode;
  detail?: string;
  status?: number;
  title?: string;
  errors?: Record<string, string[]>;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly title: string;
  public readonly detail: string;
  public readonly errors?: Record<string, string[]>;
  public readonly isOperational: boolean = true;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? ErrorCodes.UNEXPECTED_FAILURE;
    this.status = options.status ?? 500;
    this.title = options.title ?? "An error occurred";
    this.detail = options.detail ?? message;
    this.errors = options.errors;
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
  constructor(message: string, code: ErrorCode = ErrorCodes.UNAVAILABLE, status = 503) {
    super(message, {
      code,
      status,
      title: "Service unavailable",
      detail: message,
    });
  }
}

export class UnexpectedError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.UNEXPECTED_FAILURE) {
    // Always return generic safe detail for unexpected errors
    super(message, {
      code,
      status: 500,
      title: "Internal server error",
      detail: "An unexpected error occurred",
    });
  }
}
