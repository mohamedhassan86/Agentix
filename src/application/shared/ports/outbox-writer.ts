import type { WorkEnvelope } from "../work/work-envelope";

export interface IOutboxWriter {
  write(envelope: WorkEnvelope): Promise<void>;
}
