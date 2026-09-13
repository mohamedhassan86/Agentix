/**
 * SessionContext
 * (userId, activeOrganizationId | null, currentRole | null, platformInspect=false)
 * currentRole is populated by server resolution for one request, not trusted from persisted/cookie client input
 */

import type { OrganizationRole } from "./organization-role";

export interface SessionContextProps {
  userId: string;
  activeOrganizationId: string | null;
  currentRole: OrganizationRole | null;
  platformAdministrator: boolean;
}

export class SessionContext {
  readonly userId: string;
  readonly activeOrganizationId: string | null;
  readonly currentRole: OrganizationRole | null;
  readonly platformAdministrator: boolean;

  private constructor(props: SessionContextProps) {
    this.userId = props.userId;
    this.activeOrganizationId = props.activeOrganizationId;
    this.currentRole = props.currentRole;
    this.platformAdministrator = props.platformAdministrator;
  }

  static create(props: SessionContextProps): SessionContext {
    if (!props.userId) throw new Error("USER_ID_REQUIRED");
    return new SessionContext(props);
  }

  static empty(userId: string, platformAdministrator = false): SessionContext {
    return new SessionContext({
      userId,
      activeOrganizationId: null,
      currentRole: null,
      platformAdministrator,
    });
  }

  hasActiveOrganization(): boolean {
    return this.activeOrganizationId !== null;
  }

  isPlatformAdmin(): boolean {
    return this.platformAdministrator;
  }

  withActiveOrganization(orgId: string, role: OrganizationRole): SessionContext {
    return new SessionContext({
      userId: this.userId,
      activeOrganizationId: orgId,
      currentRole: role,
      platformAdministrator: this.platformAdministrator,
    });
  }

  cleared(): SessionContext {
    return new SessionContext({
      userId: this.userId,
      activeOrganizationId: null,
      currentRole: null,
      platformAdministrator: this.platformAdministrator,
    });
  }
}
