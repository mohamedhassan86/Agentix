/**
 * Organization aggregate
 * Owns organization profile, membership set, role changes, member removal/leave, ownership transfer, logical deletion
 */

export interface OrganizationProps {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export class Organization {
  readonly id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;

  private constructor(props: OrganizationProps) {
    this.id = props.id;
    this.name = props.name;
    this.slug = props.slug;
    this.ownerUserId = props.ownerUserId;
    this.deletedAt = props.deletedAt;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.version = props.version;
  }

  static create(props: OrganizationProps): Organization {
    return new Organization(props);
  }

  static createNew(params: {
    id: string;
    name: string;
    slug: string;
    ownerUserId: string;
    now: Date;
  }): Organization {
    if (!params.name || params.name.trim().length === 0) throw new Error("ORGANIZATION_NAME_REQUIRED");
    if (params.name.trim().length > 120) throw new Error("ORGANIZATION_NAME_TOO_LONG");
    if (!params.slug) throw new Error("ORGANIZATION_SLUG_REQUIRED");
    if (!params.ownerUserId) throw new Error("OWNER_USER_ID_REQUIRED");

    return new Organization({
      id: params.id,
      name: params.name.trim(),
      slug: params.slug.toLowerCase().trim(),
      ownerUserId: params.ownerUserId,
      deletedAt: null,
      createdAt: params.now,
      updatedAt: params.now,
      version: 1,
    });
  }

  isDeleted(): boolean {
    return this.deletedAt !== null;
  }

  canMutate(): boolean {
    return !this.isDeleted();
  }

  rename(params: { name?: string; slug?: string; now: Date }): void {
    if (!this.canMutate()) throw new Error("ORGANIZATION_DELETED");
    if (params.name !== undefined) {
      if (!params.name || params.name.trim().length === 0) throw new Error("ORGANIZATION_NAME_REQUIRED");
      if (params.name.trim().length > 120) throw new Error("ORGANIZATION_NAME_TOO_LONG");
      this.name = params.name.trim();
    }
    if (params.slug !== undefined) {
      if (!params.slug) throw new Error("ORGANIZATION_SLUG_REQUIRED");
      this.slug = params.slug.toLowerCase().trim();
    }
    this.updatedAt = params.now;
    this.version += 1;
  }

  transferOwnership(params: { newOwnerUserId: string; now: Date }): void {
    if (!this.canMutate()) throw new Error("ORGANIZATION_DELETED");
    if (!params.newOwnerUserId) throw new Error("NEW_OWNER_REQUIRED");
    if (params.newOwnerUserId === this.ownerUserId) throw new Error("ALREADY_OWNER");
    this.ownerUserId = params.newOwnerUserId;
    this.updatedAt = params.now;
    this.version += 1;
  }

  markDeleted(now: Date): void {
    if (this.isDeleted()) throw new Error("ORGANIZATION_ALREADY_DELETED");
    this.deletedAt = now;
    this.updatedAt = now;
    this.version += 1;
  }

  verifyDeletionConfirmation(confirmationSlug: string): void {
    if (this.slug !== confirmationSlug.toLowerCase().trim()) {
      throw new Error("CONFIRMATION_SLUG_MISMATCH");
    }
  }
}
