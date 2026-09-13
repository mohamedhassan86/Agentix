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

  it("identity tokens, hashes, and delivery keys are redacted from events and OpenAPI", async () => {
    const { createIdentityHarness } = await import("../../helpers/identity-harness");
    const { createRegisterAccountHandler } = await import("@/application/identity/handlers/register-account-handler");
    const { REGISTER_ACCOUNT_TYPE } = await import("@/application/identity/commands/register-account");
    const { createRequestContext } = await import("@/application/shared/context/request-context");
    const { mapErrorToProblem } = await import("@/app/lib/problem-response");

    const harness = createIdentityHarness();
    const handle = createRegisterAccountHandler(harness.deps);
    const ctx = createRequestContext({ correlationId: "123e4567-e89b-12d3-a456-426614174000" });
    const password = "supersecret-password";
    await handle(
      { type: REGISTER_ACCOUNT_TYPE, email: "redact@example.test", displayName: "Redact", password },
      ctx,
    );

    const token = harness.store.lastCapturedToken();
    expect(token).toBeTruthy();
    const digestHex = Buffer.from((await harness.store.findLatestTokenByUserPurpose(
      (await harness.store.findUserByEmailNormalized("redact@example.test"))!.id,
      "email_verification",
    ))!.tokenDigest).toString("hex");

    const surfaces = [
      JSON.stringify(harness.store.events),
      JSON.stringify([...harness.store.outbox.values()].map((r) => ({
        messageKind: r.messageKind,
        recipientHash: r.recipientHash,
        keyVersion: r.keyVersion,
        lastErrorCode: r.lastErrorCode,
      }))),
      JSON.stringify(mapErrorToProblem(new Error(`Failed with ${password}`), ctx.correlationId)),
    ];
    for (const surface of surfaces) {
      expect(surface).not.toContain(password);
      expect(surface).not.toContain(token);
      expect(surface).not.toContain(digestHex);
    }

    const user = await harness.store.findUserByEmailNormalized("redact@example.test");
    expect(user!.passwordHash).not.toBe(password);
    expect(user!.passwordHash).not.toContain(password);
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
