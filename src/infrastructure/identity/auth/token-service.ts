/**
 * Token service - 32 random bytes base64url, <id>.<secret>, SHA-256 digest
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import type { TokenGenerator } from "../../../application/identity/ports/token-generator";
import { v7 as uuidv7 } from "uuid";

export class TokenService implements TokenGenerator {
  async generate(): Promise<{ id: string; raw: string; digest: Uint8Array }> {
    const id = uuidv7();
    const secretBytes = randomBytes(32);
    const secret = secretBytes.toString("base64url");
    const raw = `${id}.${secret}`;
    const digest = await this.digestSecret(secret);
    return { id, raw, digest };
  }

  async digestSecret(secret: string): Promise<Uint8Array> {
    const hash = createHash("sha256").update(secret).digest();
    return new Uint8Array(hash);
  }

  verifyDigest(digest: Uint8Array, candidateDigest: Uint8Array): boolean {
    if (digest.length !== candidateDigest.length) return false;
    try {
      return timingSafeEqual(Buffer.from(digest), Buffer.from(candidateDigest));
    } catch {
      // Fallback constant-time
      let diff = 0;
      for (let i = 0; i < digest.length; i++) {
        diff |= digest[i] ^ candidateDigest[i];
      }
      return diff === 0;
    }
  }

  static parseRawToken(raw: string): { id: string; secret: string } {
    if (!raw || typeof raw !== "string" || raw.length < 40) {
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

  async hashTokenIdAndSecret(id: string, secret: string): Promise<Uint8Array> {
    // For lookup, we digest only secret, id is public selector
    return this.digestSecret(secret);
  }
}
