/**
 * WorkHandlerRegistry - registry for work handlers by type and schema version.
 * Enforces duplicate/missing detection.
 */

import type { WorkContext } from "./work-context";
import type { WorkResult } from "./work-result";

export type WorkHandler = (payload: Record<string, unknown>, context: WorkContext) => Promise<WorkResult>;

export class WorkHandlerRegistry {
  private handlers = new Map<string, WorkHandler>();

  private makeKey(type: string, schemaVersion: number): string {
    return `${type}:v${schemaVersion}`;
  }

  register(type: string, schemaVersion: number, handler: WorkHandler): void {
    if (!type || type.length < 1 || type.length > 120) {
      throw new Error("work type must be 1-120 characters");
    }
    if (schemaVersion < 1) {
      throw new Error("schemaVersion must be >=1");
    }
    const key = this.makeKey(type, schemaVersion);
    if (this.handlers.has(key)) {
      throw new Error(`Handler already registered for ${key}`);
    }
    this.handlers.set(key, handler);
  }

  get(type: string, schemaVersion: number): WorkHandler | undefined {
    return this.handlers.get(this.makeKey(type, schemaVersion));
  }

  has(type: string, schemaVersion: number): boolean {
    return this.handlers.has(this.makeKey(type, schemaVersion));
  }

  clear(): void {
    this.handlers.clear();
  }
}
