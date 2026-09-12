export interface IClock {
  now(): Date;
  nowMs(): number;
}

export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
}

export class FixedClock implements IClock {
  constructor(private fixed: Date) {}
  now(): Date {
    return new Date(this.fixed);
  }
  nowMs(): number {
    return this.fixed.getTime();
  }
}
