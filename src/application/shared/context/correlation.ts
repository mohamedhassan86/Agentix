import { v7 as uuidv7, validate as uuidValidate, version as uuidVersion } from "uuid";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidCorrelationId(id: string): boolean {
  if (!id || typeof id !== "string") return false;
  if (id.length > 100) return false; // reject excessively long
  if (!UUID_REGEX.test(id)) return false;
  if (!uuidValidate(id)) return false;
  const ver = uuidVersion(id);
  // Allow v4 and v7 (and v1 for compatibility, but prefer v4/v7)
  return ver === 4 || ver === 7 || ver === 1;
}

export function generateCorrelationId(): string {
  return uuidv7();
}

export function normalizeCorrelationId(input: string | undefined | null): string {
  if (!input || typeof input !== "string") {
    return generateCorrelationId();
  }
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 100) {
    return generateCorrelationId();
  }
  // Check if valid UUID
  if (isValidCorrelationId(trimmed)) {
    return trimmed.toLowerCase();
  }
  // Replace malformed with generated
  return generateCorrelationId();
}
