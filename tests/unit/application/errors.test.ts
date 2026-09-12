import { describe, it, expect } from "vitest";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  DomainRuleError,
  UnavailableError,
  UnexpectedError,
  AppError,
} from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";

describe("Safe error hierarchy - closed codes", () => {
  it("ValidationError has 400 and stable code", () => {
    const err = new ValidationError("invalid input", { email: ["invalid"] });
    expect(err.status).toBe(400);
    expect(err.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(err instanceof AppError).toBe(true);
  });

  it("NotFoundError has 404", () => {
    const err = new NotFoundError("not found");
    expect(err.status).toBe(404);
    expect(err.code).toBe(ErrorCodes.NOT_FOUND);
  });

  it("ConflictError has 409", () => {
    const err = new ConflictError("conflict");
    expect(err.status).toBe(409);
    expect(err.code).toBe(ErrorCodes.CONFLICT);
  });

  it("DomainRuleError has 422", () => {
    const err = new DomainRuleError("rule violated");
    expect(err.status).toBe(422);
    expect(err.code).toBe(ErrorCodes.DOMAIN_RULE_VIOLATION);
  });

  it("UnavailableError has 503", () => {
    const err = new UnavailableError("unavailable");
    expect(err.status).toBe(503);
    expect(err.code).toBe(ErrorCodes.UNAVAILABLE);
  });

  it("UnexpectedError has 500 and safe generic detail", () => {
    const err = new UnexpectedError("something exploded with secret");
    expect(err.status).toBe(500);
    expect(err.code).toBe(ErrorCodes.UNEXPECTED_FAILURE);
    // detail should be generic, not include original message if it contains sensitive
    expect(err.detail).not.toContain("secret");
  });

  it("error codes are closed and uppercase", () => {
    const allCodes = Object.values(ErrorCodes);
    for (const code of allCodes) {
      expect(code).toMatch(/^[A-Z][A-Z0-9_]{1,119}$/);
    }
  });
});
