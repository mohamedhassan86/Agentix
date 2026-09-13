import type { IdentityStore } from "@/application/identity/ports/identity-store";
import { OwnerInvariantError } from "@/domain/identity/errors/identity-errors";
import { PlatformPolicy } from "@/domain/identity/policies/platform-policy";
import type { IClock } from "@/application/shared/ports/clock";

export class PlatformAdminService {
  constructor(
    private readonly store: IdentityStore,
    private readonly clock: IClock,
  ) {}

  async grant(userId: string): Promise<void> {
    await this.store.transaction(async (store) => {
      const user = await store.findUserById(userId);
      if (!user || user.isDeleted()) throw new Error("ACCOUNT_DELETED");
      const count = await store.countActiveMembershipsByUser(userId);
      if (!PlatformPolicy.canGrantPlatformAdmin(count)) {
        throw new OwnerInvariantError("Platform administrator must have zero memberships");
      }
      user.grantPlatformAdmin(count);
      await store.updateUser(user);
      await store.revokeAllSessionsForUser(userId, this.clock.now());
    });
  }
}
