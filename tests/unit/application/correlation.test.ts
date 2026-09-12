import { describe, it, expect } from "vitest";
import { normalizeCorrelationId, generateCorrelationId, isValidCorrelationId } from "@/application/shared/context/correlation";
import { validate as uuidValidate, version as uuidVersion } from "uuid";

describe("UUID correlation normalization", () => {
  it("accepts valid UUID v4 and propagates", () => {
    const valid = "550e8400-e29b-41d4-a716-446655440000";
    const normalized = normalizeCorrelationId(valid);
    expect(normalized).toBe(valid.toLowerCase());
    expect(isValidCorrelationId(valid)).toBe(true);
  });

  it("accepts valid UUID v7 and propagates", () => {
    const v7 = "0199f000-0000-7000-8000-000000000001";
    const normalized = normalizeCorrelationId(v7);
    expect(normalized).toBe(v7);
    expect(isValidCorrelationId(v7)).toBe(true);
  });

  it("generates UUID v7 when input missing", () => {
    const generated = normalizeCorrelationId(undefined);
    expect(isValidCorrelationId(generated)).toBe(true);
    expect(uuidValidate(generated)).toBe(true);
    expect(uuidVersion(generated)).toBe(7);
  });

  it("replaces malformed correlation with generated valid UUID", () => {
    const malformed = "malformed-and-too-long-identifier-1234567890-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    const normalized = normalizeCorrelationId(malformed);
    expect(normalized).not.toBe(malformed);
    expect(isValidCorrelationId(normalized)).toBe(true);
    expect(isValidCorrelationId(malformed)).toBe(false);
  });

  it("replaces excessively long correlation", () => {
    const long = "a".repeat(200);
    const normalized = normalizeCorrelationId(long);
    expect(normalized).not.toBe(long);
    expect(isValidCorrelationId(normalized)).toBe(true);
  });

  it("generateCorrelationId produces UUID v7", () => {
    const id = generateCorrelationId();
    expect(uuidValidate(id)).toBe(true);
    expect(uuidVersion(id)).toBe(7);
  });

  it("normalization is case-insensitive and lowercases", () => {
    const upper = "550E8400-E29B-41D4-A716-446655440000";
    const normalized = normalizeCorrelationId(upper);
    expect(normalized).toBe(upper.toLowerCase());
  });
});
