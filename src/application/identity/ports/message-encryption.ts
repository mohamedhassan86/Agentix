/**
 * Message encryption port - AES-256-GCM
 */

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array; // 12 bytes
  tag: Uint8Array; // 16 bytes
  keyVersion: number;
}

export interface MessageEncryption {
  encrypt(plaintext: string, aad: string, keyVersion?: number): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, aad: string): Promise<string>;
}
