import { createHash } from "node:crypto";

export function sha256Bytes(value: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

export function sha256Base64Url(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

export function recipientHash(emailNormalized: string): string {
  return `sha256:${sha256Base64Url(emailNormalized.toLowerCase().trim())}`;
}

export function outboxAad(params: {
  outboxId: string;
  messageKind: "verification" | "invitation";
  recipientHash: string;
  keyVersion: number;
}): string {
  return `${params.outboxId}|${params.messageKind}|${params.recipientHash}|${params.keyVersion}`;
}

export function verificationActionUrl(origin: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

export function invitationActionUrl(origin: string, invitationId: string, token: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/invitations/${invitationId}?token=${encodeURIComponent(token)}`;
}

export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    let dummy = 0;
    for (let i = 0; i < a.length; i++) dummy |= a[i];
    return dummy === -1;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
