import type { IIdGenerator } from "@/application/shared/ports/id-generator";
import { v7 as uuidv7 } from "uuid";

export class UuidV7Generator implements IIdGenerator {
  generate(): string {
    return uuidv7();
  }
}
