/**
 * Identity event writer port
 */

import type { IdentityEvent } from "../../../domain/identity/events/identity-events";

export interface IdentityEventWriter {
  write(event: IdentityEvent): Promise<void>;
  writeMany(events: IdentityEvent[]): Promise<void>;
}
