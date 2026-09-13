/**
 * EmailAddress value object
 * - trims outer whitespace and normalizes case for equality
 * - validates practical email syntax and max 254 chars
 * - never used as log field
 */

export class EmailAddress {
  private readonly _value: string;
  private readonly _normalized: string;

  private constructor(value: string, normalized: string) {
    this._value = value;
    this._normalized = normalized;
  }

  static create(input: string): EmailAddress {
    if (typeof input !== "string") {
      throw new Error("EMAIL_INVALID");
    }
    const trimmed = input.trim();
    if (trimmed.length === 0) {
      throw new Error("EMAIL_REQUIRED");
    }
    if (trimmed.length > 254) {
      throw new Error("EMAIL_TOO_LONG");
    }
    // Practical email syntax: must contain @, no spaces, basic structure
    // We keep validation intentionally practical, not RFC 5322 exhaustive
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new Error("EMAIL_INVALID");
    }
    // Unicode normalization + lowercase for equality
    const normalized = trimmed.toLowerCase().normalize("NFKC");
    if (normalized.length > 254) {
      throw new Error("EMAIL_TOO_LONG");
    }
    return new EmailAddress(trimmed, normalized);
  }

  /** Original trimmed value (for display, but still normalized in this phase per spec) */
  get value(): string {
    return this._value;
  }

  /** Normalized lowercase value for equality and storage */
  get normalized(): string {
    return this._normalized;
  }

  equals(other: EmailAddress): boolean {
    return this._normalized === other._normalized;
  }

  toString(): string {
    // Intentionally returns normalized to avoid leaking original casing variants
    // Logging must still avoid email; toString is for domain use, not logs
    return this._normalized;
  }
}
