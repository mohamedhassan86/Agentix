import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MARKER_PATH = join(process.cwd(), ".agentix", "migration-status.json");

interface MigrationMarker {
  status?: "applied" | "skipped" | "failed" | "not_configured";
  reason?: string;
  source?: string;
  target?: string;
  verified?: string;
  at?: string;
}

function readMarker(): MigrationMarker | null {
  try {
    if (!existsSync(MARKER_PATH)) return null;
    return JSON.parse(readFileSync(MARKER_PATH, "utf-8")) as MigrationMarker;
  } catch {
    return null;
  }
}

/**
 * Deploy guard.
 *
 * `next build` does not touch the database, so a deployment can compile perfectly and still
 * serve a host whose schema is missing - the readiness probe then answers 503 and the UI says
 * "schema not ready". Builds that go through `npm run build:vercel` leave a marker; a Vercel
 * production build without that marker means the migration step was skipped (usually because
 * the Build Command was set in the Vercel dashboard, which overrides vercel.json).
 *
 * Default: warn loudly in the build log. Set AGENTIX_REQUIRE_MIGRATION_MARKER=true to fail the
 * build instead - useful once migrations are known to run in CI.
 */
function checkMigrationMarker(): void {
  const isVercelProduction = Boolean(process.env.VERCEL) && process.env.VERCEL_ENV === "production";
  if (!isVercelProduction) return;

  const required = ["1", "true", "yes", "on"].includes(String(process.env.AGENTIX_REQUIRE_MIGRATION_MARKER ?? "").toLowerCase());
  const marker = readMarker();

  const banner = (lines: string[]) => {
    const rule = "=".repeat(72);
    console.warn(`\n${rule}\n${lines.join("\n")}\n${rule}\n`);
  };

  if (!marker) {
    const lines = [
      "[agentix] MIGRATIONS DID NOT RUN FOR THIS DEPLOYMENT.",
      "",
      "This production build was started without the migration step, so the database may not",
      "match the code and /health/ready will answer 503 (schema not ready).",
      "",
      "FIX: set the Vercel Build Command to `npm run build:vercel`",
      "     (Project Settings -> Build & Development Settings). The dashboard value overrides",
      "     vercel.json. Or apply migrations yourself against the direct connection:",
      "     npm run db:migrate:deploy",
    ];
    if (required) {
      banner(lines);
      throw new Error("[agentix] AGENTIX_REQUIRE_MIGRATION_MARKER=true and no migration marker was found.");
    }
    banner(lines);
    return;
  }

  if (marker.status === "applied") {
    console.log(`[agentix] migrations applied to ${marker.target ?? "the configured database"} (${marker.at ?? "unknown time"})`);
    return;
  }

  const lines = [
    `[agentix] MIGRATIONS WERE NOT APPLIED BY THIS BUILD (status=${marker.status ?? "unknown"}${marker.reason ? `, reason=${marker.reason}` : ""}).`,
    "",
    "The database may not match this deployment. Check:",
    "  - Vercel Build Command should be `npm run build:vercel`",
    "  - SKIP_DB_MIGRATE / DB_MIGRATE_OPTIONAL should not be set in production",
    "  - DIRECT_URL must point at the same database as the runtime DATABASE_URL",
    "",
    "Then verify with `npm run db:diagnose` and redeploy.",
  ];
  if (required) {
    banner(lines);
    throw new Error(`[agentix] AGENTIX_REQUIRE_MIGRATION_MARKER=true and migrations were not applied (${marker.status}).`);
  }
  banner(lines);
}

checkMigrationMarker();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
};

export default nextConfig;
