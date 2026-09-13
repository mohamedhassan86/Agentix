/**
 * Password hasher port - Argon2id
 */

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  // Dummy hash for unknown email to keep timing consistent
  getDummyHash(): string;
}

export const DUMMY_PASSWORD = "dummy-password-for-unknown-email-timing-attack-protection-32chars!";
