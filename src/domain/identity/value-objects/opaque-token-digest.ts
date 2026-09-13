/**
 * OpaqueTokenDigest
 * Contains purpose, token ID/version, digest bytes, expiry metadata
 * Equality is constant-time. Raw secret is transient issuance value and cannot be serialized into DTO/event/log types
 */

export type TokenPurpose = "email_verification" | "invitation_acceptance";

export interface OpaqueTokenDigestProps {
  id: string; // public token selector, UUID
  purpose: TokenPurpose;
  digest: Uint8Array; // SHA-256 digest bytes
  version: number;
  expiresAt: Date;
  createdAt: Date;
}

export class OpaqueTokenDigest {
  readonly id: string;
  readonly purpose: TokenPurpose;
  readonly digest: Uint8Array;
  readonly version: number;
  readonly expiresAt: Date;
  readonly createdAt: Date;

  private constructor(props: OpaqueTokenDigestProps) {
    this.id = props.id;
    this.purpose = props.purpose;
    this.digest = props.digest;
    this.version = props.version;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
  }

  static create(props: OpaqueTokenDigestProps): OpaqueTokenDigest {
    if (!props.id || typeof props.id !== "string") throw new Error("TOKEN_ID_REQUIRED");
    if (!props.purpose) throw new Error("TOKEN_PURPOSE_REQUIRED");
    if (!props.digest || props.digest.length === 0) throw new Error("TOKEN_DIGEST_REQUIRED");
    if (props.version < 1) throw new Error("TOKEN_VERSION_INVALID");
    return new OpaqueTokenDigest(props);
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  /**
   * Constant-time equality for digest comparison
   */
  equalsDigest(otherDigest: Uint8Array): boolean {
    if (this.digest.length !== otherDigest.length) return false;
    let diff = 0;
    for (let i = 0; i < this.digest.length; i++) {
      diff |= this.digest[i] ^ otherDigest[i];
    }
    return diff === 0;
  }

  equals(other: OpaqueTokenDigest): boolean {
    if (this.id !== other.id) return false;
    if (this.purpose !== other.purpose) return false;
    if (this.version !== other.version) return false;
    return this.equalsDigest(other.digest);
  }
}

/**
 * Raw token format: <token-id>.<32-random-byte-base64url-secret>
 * This helper parses the raw token into id and secret parts without validating secret
 */
export function parseRawTokenFormat(raw: string): { id: string; secret: string } {
  if (typeof raw !== "string" || raw.length < 40) {
    throw new Error("TOKEN_INVALID_FORMAT");
  }
  const parts = raw.split(".");
  if (parts.length !== 2) {
    throw new Error("TOKEN_INVALID_FORMAT");
  }
  const [id, secret] = parts;
  if (!id || !secret) {
    throw new Error("TOKEN_INVALID_FORMAT");
  }
  return { id, secret };
}
