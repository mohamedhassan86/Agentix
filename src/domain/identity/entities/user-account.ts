/**
 * UserAccount aggregate
 * Owns registration state, email verification status, platform-admin compatibility, logical deletion
 */

export interface UserAccountProps {
  id: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  isPlatformAdmin: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class UserAccount {
  readonly id: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  isPlatformAdmin: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  private constructor(props: UserAccountProps) {
    this.id = props.id;
    this.emailNormalized = props.emailNormalized;
    this.displayName = props.displayName;
    this.passwordHash = props.passwordHash;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.isPlatformAdmin = props.isPlatformAdmin;
    this.deletedAt = props.deletedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
  }

  static create(props: UserAccountProps): UserAccount {
    return new UserAccount(props);
  }

  static register(params: {
    id: string;
    emailNormalized: string;
    displayName: string;
    passwordHash: string;
    now: Date;
  }): UserAccount {
    if (!params.emailNormalized) throw new Error("EMAIL_REQUIRED");
    if (!params.displayName || params.displayName.trim().length === 0) throw new Error("DISPLAY_NAME_REQUIRED");
    if (params.displayName.trim().length > 120) throw new Error("DISPLAY_NAME_TOO_LONG");
    if (!params.passwordHash) throw new Error("PASSWORD_HASH_REQUIRED");

    return new UserAccount({
      id: params.id,
      emailNormalized: params.emailNormalized.toLowerCase().trim(),
      displayName: params.displayName.trim(),
      passwordHash: params.passwordHash,
      emailVerifiedAt: null,
      isPlatformAdmin: false,
      deletedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
      version: 1,
    });
  }

  isVerified(): boolean {
    return this.emailVerifiedAt !== null;
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  canAuthenticate(): boolean {
    return !this.isDeleted();
  }

  markVerified(now: Date): { alreadyVerified: boolean } {
    if (this.isDeleted()) throw new Error("ACCOUNT_DELETED");
    if (this.emailVerifiedAt) {
      return { alreadyVerified: true };
    }
    this.emailVerifiedAt = now;
    this.updatedAt = now;
    this.version += 1;
    return { alreadyVerified: false };
  }

  markDeleted(now: Date): void {
    if (this.isDeleted()) throw new Error("ACCOUNT_ALREADY_DELETED");
    this.deletedAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  grantPlatformAdmin(activeMembershipCount: number): void {
    if (this.isDeleted()) throw new Error("ACCOUNT_DELETED");
    if (activeMembershipCount > 0) {
      throw new Error("PLATFORM_ADMIN_REQUIRES_ZERO_MEMBERSHIPS");
    }
    if (this.isPlatformAdmin) return;
    this.isPlatformAdmin = true;
    this.updatedAt = new Date();
    this.version += 1;
  }

  revokePlatformAdmin(): void {
    if (!this.isPlatformAdmin) return;
    this.isPlatformAdmin = false;
    this.updatedAt = new Date();
    this.version += 1;
  }

  updateDisplayName(displayName: string, now: Date): void {
    if (this.isDeleted()) throw new Error("ACCOUNT_DELETED");
    if (!displayName || displayName.trim().length === 0) throw new Error("DISPLAY_NAME_REQUIRED");
    if (displayName.trim().length > 120) throw new Error("DISPLAY_NAME_TOO_LONG");
    this.displayName = displayName.trim();
    this.updatedAt = now;
    this.version += 1;
  }
}
