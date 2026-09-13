/**
 * Session aggregate - owns opaque session lifecycle and selected org pointer, not authoritative role
 */

export interface SessionProps {
  id: string;
  sessionTokenDigest: Uint8Array;
  userId: string;
  activeOrgId: string | null;
  expiresAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  version: number;
}

export class Session {
  readonly id: string;
  sessionTokenDigest: Uint8Array;
  userId: string;
  activeOrgId: string | null;
  expiresAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
  version: number;

  private constructor(props: SessionProps) {
    this.id = props.id;
    this.sessionTokenDigest = props.sessionTokenDigest;
    this.userId = props.userId;
    this.activeOrgId = props.activeOrgId;
    this.expiresAt = props.expiresAt;
    this.lastSeenAt = props.lastSeenAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.revokedAt = props.revokedAt;
    this.version = props.version;
  }

  static create(props: SessionProps): Session {
    return new Session(props);
  }

  static start(params: {
    id: string;
    sessionTokenDigest: Uint8Array;
    userId: string;
    expiresAt: Date;
    now: Date;
  }): Session {
    return new Session({
      id: params.id,
      sessionTokenDigest: params.sessionTokenDigest,
      userId: params.userId,
      activeOrgId: null, // null at sign-in per FR-005
      expiresAt: params.expiresAt,
      lastSeenAt: params.now,
      createdAt: params.now,
      updatedAt: params.now,
      revokedAt: null,
      version: 1,
    });
  }

  isRevoked(): boolean {
    return this.revokedAt !== null;
  }

  isExpired(now: Date = new Date()): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }

  isValid(now: Date = new Date()): boolean {
    return !this.isRevoked() && !this.isExpired(now);
  }

  selectOrganization(orgId: string, now: Date): void {
    if (!this.isValid(now)) throw new Error("SESSION_INVALID");
    this.activeOrgId = orgId;
    this.lastSeenAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  clearOrganization(now: Date): void {
    this.activeOrgId = null;
    this.updatedAt = now;
    this.version += 1;
  }

  revoke(now: Date): void {
    if (this.isRevoked()) return;
    this.revokedAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  rotate(newDigest: Uint8Array, newExpiresAt: Date, now: Date): void {
    if (!this.isValid(now)) throw new Error("SESSION_INVALID");
    this.sessionTokenDigest = newDigest;
    this.expiresAt = newExpiresAt;
    this.lastSeenAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  touch(now: Date): void {
    this.lastSeenAt = now;
    this.updatedAt = now;
  }
}
