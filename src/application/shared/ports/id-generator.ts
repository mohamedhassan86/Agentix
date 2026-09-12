import { v7 as uuidv7 } from "uuid";

export interface IIdGenerator {
  generate(): string;
}

export class UuidV7IdGenerator implements IIdGenerator {
  generate(): string {
    return uuidv7();
  }
}

export class FixedIdGenerator implements IIdGenerator {
  private counter = 0;
  constructor(private prefix: string = "0199f000-0000-7000-8000-") {}

  generate(): string {
    this.counter++;
    const suffix = String(this.counter).padStart(12, "0");
    return `${this.prefix}${suffix}`;
  }
}
