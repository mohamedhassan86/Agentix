import { resetCapturedMessageAdapter } from "@/infrastructure/identity/messaging/captured-message-adapter";

export function cleanupCapturedMessages(): void {
  resetCapturedMessageAdapter();
}
