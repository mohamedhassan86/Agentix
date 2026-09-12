import type { IClock } from "@/application/shared/ports/clock";

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
}
