/**
 * AES-256-GCM encryption - Node crypto, AAD binds id/kind/recipientHash/keyVersion
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { MessageEncryption, EncryptedPayload } from "../../../application/identity/ports/message-encryption";
import { getConfig } from "../../config/load-config";

export class AesGcmEncryption implements MessageEncryption {
  private getKey(keyVersion?: number): Buffer {
    const config = getConfig();
    const keyB64 = config.messaging.deliveryKey;
    // Support base64 or raw string - if not valid base64, hash it to 32 bytes
    let key: Buffer;
    try {
      key = Buffer.from(keyB64, "base64");
      if (key.length !== 32) {
        // If not 32 bytes, try to use as utf8 and pad/truncate via SHA256
        const { createHash } = require("crypto");
        key = createHash("sha256").update(keyB64).digest();
      }
    } catch {
      const { createHash } = require("crypto");
      key = createHash("sha256").update(keyB64).digest();
    }
    return key;
  }

  async encrypt(plaintext: string, aad: string, keyVersion?: number): Promise<EncryptedPayload> {
    const key = this.getKey(keyVersion);
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, nonce);

    // AAD binds outbox_id, message_kind, recipient_hash, key_version per spec
    cipher.setAAD(Buffer.from(aad, "utf8"));

    const ciphertextPart = cipher.update(plaintext, "utf8");
    const finalPart = cipher.final();
    const ciphertext = Buffer.concat([ciphertextPart, finalPart]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: new Uint8Array(ciphertext),
      nonce: new Uint8Array(nonce),
      tag: new Uint8Array(tag),
      keyVersion: keyVersion ?? 1,
    };
  }

  async decrypt(payload: EncryptedPayload, aad: string): Promise<string> {
    const key = this.getKey(payload.keyVersion);
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.nonce));
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(Buffer.from(payload.tag));

    const decryptedPart = decipher.update(Buffer.from(payload.ciphertext));
    const finalPart = decipher.final();
    const plaintext = Buffer.concat([decryptedPart, finalPart]).toString("utf8");

    return plaintext;
  }
}
