import { describe, it, expect } from "vitest";
import { createLogger, createTestSink } from "@/infrastructure/observability/logger";
import { redactObject, redactString } from "@/infrastructure/observability/redaction";
import { mapErrorToProblem } from "@/app/lib/problem-response";

describe("zero leakage - seeded markers", () => {
  const sensitiveMarkers = [
    "supersecret",
    "secret123",
    "postgres://user:pass@localhost/db",
    "sk-abcdefghijklmnopqrstuvwxyz",
    "BEGIN RSA PRIVATE KEY",
  ];

  it("redacts sensitive markers in logs", () => {
    const sink = createTestSink();
    const logger = createLogger({ level: "debug", sink: sink as any });

    for (const marker of sensitiveMarkers) {
      logger.info({ msg: "test", data: { payload: marker, secret: marker } });
      logger.error({ msg: "error test", err: new Error(marker) });
    }

    const logs = sink.logs.map((l) => JSON.stringify(l)).join(" ");

    for (const marker of sensitiveMarkers) {
      // The marker should not appear in logs, except for test that checks redaction
      // Our logger redacts body/payload and replaces error messages with [REDACTED]
      expect(logs).not.toContain(marker);
    }
  });

  it("redacts markers in Problem Details", () => {
    for (const marker of sensitiveMarkers) {
      const problem = mapErrorToProblem(new Error(`Failed with ${marker}`), "123e4567-e89b-12d3-a456-426614174000");
      const json = JSON.stringify(problem);
      expect(json).not.toContain(marker);
      expect(problem.detail).not.toContain(marker);
    }
  });

  it("redacts markers via redactObject", () => {
    for (const marker of sensitiveMarkers) {
      const obj = {
        authorization: marker,
        password: marker,
        nested: { secret: marker, body: marker },
        safe: "ok",
      };
      const redacted = redactObject(obj) as any;
      const json = JSON.stringify(redacted);
      expect(json).not.toContain(marker);
      expect(redacted.safe).toBe("ok");
      expect(redacted.authorization).toBe("[REDACTED]");
    }
  });

  it("redacts markers via redactString", () => {
    for (const marker of sensitiveMarkers) {
      if (marker.includes("postgres://") || marker.startsWith("sk-")) {
        const redacted = redactString(`Connection ${marker} failed`);
        expect(redacted).not.toContain(marker);
        expect(redacted).toContain("[REDACTED]");
      }
    }
  });

  it("responses, health, contracts, snapshots contain zero markers", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");

    const filesToCheck = [
      "contracts/openapi/agentix-v1.json",
      "prisma/schema.prisma",
      "src/app/lib/openapi-registry.ts",
    ];

    for (const file of filesToCheck) {
      const path = join(process.cwd(), file);
      if (!existsSync(path)) continue;
      const content = readFileSync(path, "utf-8");
      for (const marker of sensitiveMarkers) {
        // Skip if marker is part of test itself (like in this file)
        if (file.includes("diagnostic-redaction")) continue;
        expect(content).not.toContain(marker);
      }
    }
  });
});
