import { createHash, randomBytes } from "node:crypto";
import type { PasswordHasher } from "@/application/identity/ports/password-hasher";
import type { TokenGenerator } from "@/application/identity/ports/token-generator";
import type { MessageEncryption, EncryptedPayload } from "@/application/identity/ports/message-encryption";
import { v7 as uuidv7 } from "uuid";

export class TestPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `test-kdf:${createHash("sha256").update(password).digest("hex")}`;
  }
  async verify(hash: string, password: string): Promise<boolean> {
    if (hash === this.getDummyHash()) return false;
    const expected = await this.hash(password);
    return hash === expected;
  }
  getDummyHash(): string {
    return "test-kdf:dummy-hash-for-unknown-email-timing";
  }
}

export class TestTokenGenerator implements TokenGenerator {
  async generate(): Promise<{ id: string; raw: string; digest: Uint8Array }> {
    const id = uuidv7();
    const secret = randomBytes(32).toString("base64url");
    const raw = `${id}.${secret}`;
    const digest = await this.digestSecret(secret);
    return { id, raw, digest };
  }
  async digestSecret(secret: string): Promise<Uint8Array> {
    return new Uint8Array(createHash("sha256").update(secret).digest());
  }
  verifyDigest(digest: Uint8Array, candidateDigest: Uint8Array): boolean {
    if (digest.length !== candidateDigest.length) return false;
    let diff = 0;
    for (let i = 0; i < digest.length; i++) diff |= digest[i] ^ candidateDigest[i];
    return diff === 0;
  }
}

export class TestEncryption implements MessageEncryption {
  async encrypt(plaintext: string, _aad: string, keyVersion = 1): Promise<EncryptedPayload> {
    const ciphertext = new Uint8Array(Buffer.from(plaintext, "utf8"));
    return { ciphertext, nonce: new Uint8Array(12), tag: new Uint8Array(16), keyVersion };
  }
  async decrypt(payload: EncryptedPayload, _aad: string): Promise<string> {
    return Buffer.from(payload.ciphertext).toString("utf8");
  }
}
