/**
 * Message delivery port
 */

export type MessageKind = "verification" | "invitation";
export type DeliveryResult = { success: true } | { success: false; errorCode: string };

export interface MessageDeliveryPayload {
  recipient: string;
  template: string;
  parameters: {
    organizationName?: string;
    inviterDisplayName?: string;
    displayName?: string;
    role?: string;
    actionUrl: string;
    expiresAt: string;
  };
}

export interface MessageDeliveryPort {
  send(payload: MessageDeliveryPayload): Promise<DeliveryResult>;
}

export const STABLE_DELIVERY_ERROR_CODES = {
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  INVALID_RECIPIENT: "INVALID_RECIPIENT",
  RATE_LIMITED: "RATE_LIMITED",
  UNKNOWN: "UNKNOWN",
} as const;
