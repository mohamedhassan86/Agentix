/**
 * OneTimeToken - shared persistence shape for verification and invitation token versions
 */

import type { TokenPurpose } from "../value-objects/opaque-token-digest";

export interface OneTimeTokenProps {
  id: string;
  purpose: TokenPurpose;
  userId: string | null;
  invitationId: string | null;
  orgId: string | null;
  tokenDigest: Uint8Array;
  version: number;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export class OneTimeToken {
  readonly id: string;
  purpose: TokenPurpose;
  userId: string | null;
  invitationId: string | null;
  orgId: string | null;
  tokenDigest: Uint8Array;
  version: number;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;

  private constructor(props: OneTimeTokenProps) {
    this.id = props.id;
    this.purpose = props.purpose;
    this.userId = props.userId;
    this.invitationId = props.invitationId;
    this.orgId = props.orgId;
    this.tokenDigest = props.tokenDigest;
    this.version = props.version;
    this.expiresAt = props.expiresAt;
    this.consumedAt = props.consumedAt;
    this.revokedAt = props.revokedAt;
    this.createdAt = props.createdAt;
  }

  static create(props: OneTimeTokenProps): OneTimeToken {
    if (props.purpose === "email_verification" && !props.userId) {
      throw new Error("USER_ID_REQUIRED_FOR_VERIFICATION");
    }
    if (props.purpose === "invitation_acceptance" && !props.invitationId) {
      throw new Error("INVITATION_ID_REQUIRED_FOR_INVITATION");
    }
    return new OneTimeToken(props);
  }

  static issueVerification(params: {
    id: string;
    userId: string;
    tokenDigest: Uint8Array;
    now: Date;
  }): OneTimeToken {
    return new OneTimeToken({
      id: params.id,
      purpose: "email_verification",
      userId: params.userId,
      invitationId: null,
      orgId: null,
      tokenDigest: params.tokenDigest,
      version: 1,
      expiresAt: new Date(params.now.getTime() + 24 * 60 * 60 * 1000), // 24h
      consumedAt: null,
      revokedAt: null,
      createdAt: params.now,
    });
  }

  static issueInvitation(params: {
    id: string;
    invitationId: string;
    orgId: string;
    tokenDigest: Uint8Array;
    version: number;
    now: Date;
  }): OneTimeToken {
    return new OneTimeToken({
      id: params.id,
      purpose: "invitation_acceptance",
      userId: null,
      invitationId: params.invitationId,
      orgId: params.orgId,
      tokenDigest: params.tokenDigest,
      version: params.version,
      expiresAt: new Date(params.now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7d
      consumedAt: null,
      revokedAt: null,
      createdAt: params.now,
    });
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isConsumed(): boolean {
    return this.consumedAt !== null;
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isValid(now: Date = new Date()): boolean {
    return !this.isExpired(now) && !this.isConsumed() && !this.isRevoked();
  }

  consume(now: Date): void {
    if (!this.isValid(now)) {
      if (this.isExpired(now)) throw new Error("TOKEN_EXPIRED");
      if (this.isConsumed()) throw new Error("TOKEN_ALREADY_CONSUMED");
      if (this.isRevoked()) throw new Error("TOKEN_REVOKED");
      throw new Error("TOKEN_INVALID");
    }
    this.consumedAt = now;
  }

  revoke(now: Date): void {
    if (this.isConsumed()) throw new Error("TOKEN_ALREADY_CONSUMED");
    if (this.isRevoked()) return;
    this.revokedAt = now;
  }

  equalsDigest(other: Uint8Array): boolean {
    if (this.tokenDigest.length !== other.length) return false;
    let diff = 0;
    for (let i = 0; i < this.tokenDigest.length; i++) {
      diff |= this.tokenDigest[i] ^ other[i];
    }
    return diff === 0;
  }
}
