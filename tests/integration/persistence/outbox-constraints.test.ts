import { describe, it, expect } from "vitest";
import { validateWorkEnvelope, globalWork, tenantWork } from "@/application/shared/work/work-envelope";

describe("outbox constraints - application boundary", () => {
  it("rejects payload >64 KiB", () => {
    const largePayload = { data: "a".repeat(70 * 1024) };
    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000001",
        type: "test.work",
        schemaVersion: 1,
        scope: "global",
        idempotencyKey: "key-1",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: largePayload,
      })
    ).toThrow(/64 KiB/i);
  });

  it("rejects sensitive keys in payload", () => {
    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000002",
        type: "test.work",
        schemaVersion: 1,
        scope: "global",
        idempotencyKey: "key-2",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: { password: "secret123" },
      })
    ).toThrow(/sensitive key/i);
  });

  it("rejects invalid scope combinations", () => {
    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000003",
        type: "test.work",
        schemaVersion: 1,
        scope: "global",
        orgId: "org-123",
        idempotencyKey: "key-3",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow(/global.*null/i);

    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000004",
        type: "test.work",
        schemaVersion: 1,
        scope: "tenant",
        orgId: null,
        idempotencyKey: "key-4",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow(/tenant.*orgId/i);
  });

  it("validates work type length 1-120", () => {
    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000005",
        type: "",
        schemaVersion: 1,
        scope: "global",
        idempotencyKey: "key-5",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow(/work type/i);

    expect(() =>
      validateWorkEnvelope({
        workId: "0199f000-0000-7000-8000-000000000006",
        type: "a".repeat(121),
        schemaVersion: 1,
        scope: "global",
        idempotencyKey: "key-6",
        correlationId: "123e4567-e89b-12d3-a456-426614174000",
        payload: {},
      })
    ).toThrow(/work type/i);
  });

  it("globalWork and tenantWork factories enforce scope", () => {
    const g = globalWork({
      workId: "0199f000-0000-7000-8000-000000000007",
      type: "test.global",
      schemaVersion: 1,
      idempotencyKey: "g-key",
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      payload: {},
    });
    expect(g.scope).toBe("global");
    expect(g.orgId).toBeNull();

    const t = tenantWork("org-123", {
      workId: "0199f000-0000-7000-8000-000000000008",
      type: "test.tenant",
      schemaVersion: 1,
      idempotencyKey: "t-key",
      correlationId: "123e4567-e89b-12d3-a456-426614174000",
      payload: {},
    });
    expect(t.scope).toBe("tenant");
    expect(t.orgId).toBe("org-123");
  });
});
