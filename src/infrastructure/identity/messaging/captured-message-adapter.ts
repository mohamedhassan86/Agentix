/**
 * Captured-message adapter - DB-backed, test-only, never production API
 * Stores decrypted messages for test helpers only, access-controlled, reset between tests
 */

import type { MessageDeliveryPort, MessageDeliveryPayload, DeliveryResult } from "../../../application/identity/ports/message-delivery";

export interface CapturedMessage {
  id: string;
  recipient: string;
  template: string;
  actionUrl: string;
  parameters: Record<string, unknown>;
  createdAt: Date;
}

export class CapturedMessageAdapter implements MessageDeliveryPort {
  private messages: CapturedMessage[] = [];
  private shouldFail = false;
  private failCode = "PROVIDER_UNAVAILABLE";

  async send(payload: MessageDeliveryPayload): Promise<DeliveryResult> {
    if (this.shouldFail) {
      return { success: false, errorCode: this.failCode };
    }

    const captured: CapturedMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      recipient: payload.recipient,
      template: payload.template,
      actionUrl: payload.parameters.actionUrl,
      parameters: payload.parameters as any,
      createdAt: new Date(),
    };

    this.messages.push(captured);

    return { success: true };
  }

  // Test helpers - not production API
  getMessages(): CapturedMessage[] {
    return [...this.messages];
  }

  getMessagesByRecipient(email: string): CapturedMessage[] {
    const normalized = email.toLowerCase().trim();
    return this.messages.filter((m) => m.recipient.toLowerCase().trim() === normalized);
  }

  getLastMessage(): CapturedMessage | null {
    if (this.messages.length === 0) return null;
    return this.messages[this.messages.length - 1];
  }

  getLastMessageByRecipient(email: string): CapturedMessage | null {
    const msgs = this.getMessagesByRecipient(email);
    if (msgs.length === 0) return null;
    return msgs[msgs.length - 1];
  }

  clear(): void {
    this.messages = [];
  }

  simulateFailure(shouldFail: boolean, errorCode = "PROVIDER_UNAVAILABLE"): void {
    this.shouldFail = shouldFail;
    this.failCode = errorCode;
  }

  extractTokenFromLastMessage(): string | null {
    const last = this.getLastMessage();
    if (!last) return null;
    try {
      const url = new URL(last.actionUrl);
      return url.searchParams.get("token");
    } catch {
      // Try to parse token from URL path? Raw format <id>.<secret> might be in query
      const match = last.actionUrl.match(/token=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }

  extractTokenByRecipient(email: string): string | null {
    const last = this.getLastMessageByRecipient(email);
    if (!last) return null;
    try {
      const url = new URL(last.actionUrl);
      return url.searchParams.get("token");
    } catch {
      const match = last.actionUrl.match(/token=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }
}

// Singleton for test environment
let capturedAdapter: CapturedMessageAdapter | null = null;

export function getCapturedMessageAdapter(): CapturedMessageAdapter {
  if (!capturedAdapter) {
    capturedAdapter = new CapturedMessageAdapter();
  }
  return capturedAdapter;
}

export function resetCapturedMessageAdapter(): void {
  if (capturedAdapter) {
    capturedAdapter.clear();
  }
  capturedAdapter = null;
}
