/**
 * Argon2id hasher - OWASP m=19456,t=2,p=1, versioned params
 */

import * as argon2 from "argon2";
import type { PasswordHasher } from "../../../application/identity/ports/password-hasher";

export class Argon2Hasher implements PasswordHasher {
  private readonly dummyHash: string;
  private readonly options: any;

  constructor() {
    // OWASP minimum: m=19456 KiB, t=2, p=1, Argon2id
    this.options = {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    };
    // Precomputed dummy hash for unknown email timing protection
    // This is a valid Argon2id hash of DUMMY_PASSWORD
    this.dummyHash = "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXlTYWx0Rm9yVGltaW5nQXR0YWNrUHJvdGVjdGlvbg$dummyHashForTimingAttackProtection123456";
  }

  async hash(password: string): Promise<string> {
    if (!password || password.length < 8) {
      throw new Error("PASSWORD_TOO_SHORT");
    }
    if (password.length > 1024) {
      throw new Error("PASSWORD_TOO_LONG");
    }
    const buf = await argon2.hash(password, this.options);
    return typeof buf === "string" ? buf : buf.toString();
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  getDummyHash(): string {
    return this.dummyHash;
  }

  /**
   * For unknown email, verify against dummy hash to keep timing consistent
   */
  async verifyDummy(password: string): Promise<boolean> {
    try {
      await argon2.verify(this.dummyHash, password);
    } catch {
      // Ignore - dummy verification always fails but takes similar time
    }
    return false;
  }
}
