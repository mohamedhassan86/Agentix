/**
 * Token generator port - 32 random bytes base64url, <id>.<secret>, SHA-256 digest
 */

export interface TokenGenerator {
  generate(): Promise<{ id: string; raw: string; digest: Uint8Array }>;
  digestSecret(secret: string): Promise<Uint8Array>;
  verifyDigest(digest: Uint8Array, candidateDigest: Uint8Array): boolean;
}

export interface TokenPayload {
  id: string;
  raw: string; // <id>.<secret> - only in issued message, never stored
  digest: Uint8Array; // SHA-256 digest stored
}
