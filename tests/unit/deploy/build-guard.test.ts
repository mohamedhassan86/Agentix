import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";

/**
 * `next build` never touches the database, so a production deployment can compile perfectly and
 * still serve a host whose schema is missing. next.config.ts turns that silent failure into a
 * loud build-log warning (and an optional hard failure).
 */
async function importGuard(env: Record<string, string>) {
  const warnings: string[] = [];
  const warn = vi.spyOn(console, "warn").mockImplementation((...args) => warnings.push(args.join(" ")));
  const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.resetModules();
  const previous = { ...process.env };
  try {
    Object.assign(process.env, env);
    const result = await import("../../../next.config");
    return { warnings, config: result.default, warn, log };
  } finally {
    process.env = previous;
  }
}

describe("production build migration guard", () => {
  const markerPath = ".agentix/migration-status.json";

  beforeEach(() => {
    rmSync(".agentix", { recursive: true, force: true });
  });

  afterEach(() => {
    rmSync(".agentix", { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  const writeMarker = (payload: Record<string, unknown>) => {
    mkdirSync(".agentix", { recursive: true });
    writeFileSync(markerPath, JSON.stringify(payload));
  };

  it("stays quiet outside a Vercel production build", async () => {
    const { warnings } = await importGuard({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(warnings.join("\n")).not.toMatch(/MIGRATIONS/);
  });

  it("warns loudly when a production build has no migration marker", async () => {
    const { warnings } = await importGuard({ VERCEL: "1", VERCEL_ENV: "production" });
    const text = warnings.join("\n");
    expect(text).toMatch(/MIGRATIONS DID NOT RUN FOR THIS DEPLOYMENT/);
    expect(text).toMatch(/npm run build:vercel/);
    expect(text).toMatch(/npm run db:migrate:deploy/);
  });

  it("warns when migrations were skipped or failed, and names the reason", async () => {
    writeMarker({ status: "skipped", reason: "preview_build" });
    const { warnings } = await importGuard({ VERCEL: "1", VERCEL_ENV: "production" });
    const text = warnings.join("\n");
    expect(text).toMatch(/MIGRATIONS WERE NOT APPLIED BY THIS BUILD/);
    expect(text).toMatch(/status=skipped, reason=preview_build/);
    expect(text).toMatch(/DIRECT_URL must point at the same database/);
  });

  it("stays silent when the deploy applied migrations, and reports the target", async () => {
    writeMarker({ status: "applied", target: "aws-0-eu-west-1.pooler.supabase.com:5432/postgres", at: "2026-01-01T00:00:00.000Z" });
    const { warnings, log } = await importGuard({ VERCEL: "1", VERCEL_ENV: "production" });
    expect(warnings.join("\n")).not.toMatch(/MIGRATIONS DID NOT RUN|MIGRATIONS WERE NOT APPLIED/);
    expect(log.mock.calls.map((call) => call.join(" ")).join("\n")).toMatch(/migrations applied to aws-0-eu-west-1\.pooler\.supabase\.com:5432\/postgres/);
  });

  it("can be made fatal with AGENTIX_REQUIRE_MIGRATION_MARKER", async () => {
    const previous = process.env.AGENTIX_REQUIRE_MIGRATION_MARKER;
    process.env.AGENTIX_REQUIRE_MIGRATION_MARKER = "true";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";
    vi.resetModules();
    try {
      await expect(import("../../../next.config")).rejects.toThrow(/AGENTIX_REQUIRE_MIGRATION_MARKER/);
    } finally {
      if (previous === undefined) delete process.env.AGENTIX_REQUIRE_MIGRATION_MARKER;
      else process.env.AGENTIX_REQUIRE_MIGRATION_MARKER = previous;
      delete process.env.VERCEL;
      delete process.env.VERCEL_ENV;
      vi.restoreAllMocks();
    }
  });
});
