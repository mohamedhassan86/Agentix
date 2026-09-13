import { configSchema, parseCorsOrigins } from "./schema";
import { RUNTIME_DATABASE_URL_KEYS, resolveRuntimeDatabaseUrl } from "./database-url";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * True when a ConfigError concerns the database dependency, so the HTTP layer can answer
 * 503 + `dependency: database` instead of an opaque 500.
 */
export function isDatabaseConfigError(error: unknown): boolean {
  if (!(error instanceof ConfigError)) return false;
  return /DATABASE_URL|DIRECT_URL|POSTGRES_|Supabase|database/i.test(error.message);
}

/**
 * Derive the deployment origin from the host's own environment when APP_ORIGIN
 * was not set explicitly (Vercel injects these for every deployment).
 */
export function resolveOriginFromHostEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  // Only trust these variables when the build actually runs on Vercel.
  if (!env.VERCEL) return null;
  const candidates = [env.VERCEL_PROJECT_PRODUCTION_URL, env.VERCEL_BRANCH_URL, env.VERCEL_URL];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).origin;
    } catch {
      continue;
    }
  }
  return null;
}

export interface AppConfig {
  databaseUrl: string;
  /** Name of the environment variable the connection string came from (never the value). */
  databaseUrlSource: string;
  app: {
    origin: string | null;
    corsOrigins: string[];
    env: "development" | "production" | "test";
  };
  worker: {
    pollIntervalMs: number;
    batchSize: number;
    leaseSeconds: number;
    maxAttempts: number;
    shutdownSeconds: number;
  };
  foundation: {
    demoEnabled: boolean;
  };
  log: {
    level: "debug" | "info" | "warn" | "error";
  };
  otel: {
    tracesUrl?: string;
    metricsUrl?: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Resolve the connection string from the canonical name or the names injected by
  // the Supabase <-> Vercel integration (POSTGRES_PRISMA_URL / POSTGRES_URL).
  const resolvedDatabaseUrl = resolveRuntimeDatabaseUrl(env);
  const databaseUrl = resolvedDatabaseUrl?.url;
  if (!databaseUrl) {
    throw new ConfigError(
      `Database connection string is missing. Remediation: set DATABASE_URL (accepted alternative names: ${RUNTIME_DATABASE_URL_KEYS.filter((k) => k !== "DATABASE_URL").join(", ")}) in the host environment and redeploy. Value must not be logged.`
    );
  }

  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  let appOrigin: string | null = null;
  if (isProduction) {
    const origin = env.APP_ORIGIN ?? resolveOriginFromHostEnv(env);
    if (!origin) {
      throw new ConfigError(
        "APP_ORIGIN is required in production. Remediation: set APP_ORIGIN to the exact origin URL (e.g. https://example.com) in environment."
      );
    }
    try {
      const url = new URL(origin.includes("://") ? origin : `https://${origin}`);
      appOrigin = url.origin;
    } catch {
      throw new ConfigError(
        "APP_ORIGIN is invalid. Remediation: set APP_ORIGIN to a valid URL like https://example.com"
      );
    }
  } else {
    if (env.APP_ORIGIN) {
      try {
        appOrigin = new URL(env.APP_ORIGIN).origin;
      } catch {
        throw new ConfigError("APP_ORIGIN is invalid. Remediation: set to a valid URL");
      }
    } else {
      appOrigin = "http://localhost:3000";
    }
  }

  let corsOrigins: string[] = [];
  try {
    corsOrigins = parseCorsOrigins(env.CORS_ORIGINS);
  } catch (e) {
    throw new ConfigError(`CORS_ORIGINS invalid: ${(e as Error).message}. Remediation: set comma-separated exact origins like https://example.com`);
  }

  const pollIntervalMs = env.WORKER_POLL_INTERVAL_MS ? Number(env.WORKER_POLL_INTERVAL_MS) : 1000;
  if (isNaN(pollIntervalMs) || pollIntervalMs < 100 || pollIntervalMs > 10000) {
    throw new ConfigError("WORKER_POLL_INTERVAL_MS must be between 100 and 10000. Remediation: set to 1000");
  }

  const batchSize = env.WORKER_BATCH_SIZE ? Number(env.WORKER_BATCH_SIZE) : 10;
  if (isNaN(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new ConfigError("WORKER_BATCH_SIZE must be between 1 and 100. Remediation: set to 10");
  }

  const leaseSeconds = env.WORKER_LEASE_SECONDS ? Number(env.WORKER_LEASE_SECONDS) : 30;
  if (isNaN(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 300) {
    throw new ConfigError("WORKER_LEASE_SECONDS must be between 5 and 300. Remediation: set to 30");
  }

  const maxAttemptsRaw = env.WORKER_MAX_ATTEMPTS ? Number(env.WORKER_MAX_ATTEMPTS) : 3;
  if (isNaN(maxAttemptsRaw) || maxAttemptsRaw < 1 || maxAttemptsRaw > 10) {
    throw new ConfigError("WORKER_MAX_ATTEMPTS must be between 1 and 10 (bounded). Remediation: set to 3");
  }

  const shutdownSeconds = env.WORKER_SHUTDOWN_SECONDS ? Number(env.WORKER_SHUTDOWN_SECONDS) : 30;
  if (isNaN(shutdownSeconds) || shutdownSeconds < 5 || shutdownSeconds > 120) {
    throw new ConfigError("WORKER_SHUTDOWN_SECONDS must be between 5 and 120. Remediation: set to 30");
  }

  let demoEnabled: boolean;
  if (env.FOUNDATION_DEMO_ENABLED !== undefined) {
    demoEnabled = env.FOUNDATION_DEMO_ENABLED === "true" || env.FOUNDATION_DEMO_ENABLED === "1";
  } else {
    demoEnabled = !isProduction;
  }

  const logLevel = (env.LOG_LEVEL as any) ?? "info";
  const allowedLevels = ["debug", "info", "warn", "error"];
  if (!allowedLevels.includes(logLevel)) {
    throw new ConfigError(`LOG_LEVEL must be one of ${allowedLevels.join(", ")}. Remediation: set LOG_LEVEL to info`);
  }

  const raw = {
    databaseUrl,
    app: {
      origin: appOrigin ?? undefined,
      corsOrigins,
    },
    worker: {
      pollIntervalMs,
      batchSize,
      leaseSeconds,
      maxAttempts: maxAttemptsRaw,
      shutdownSeconds,
    },
    foundation: {
      demoEnabled,
    },
    log: {
      level: logLevel,
    },
    otel: {
      tracesUrl: env.OTEL_TRACES_EXPORTER_URL || undefined,
      metricsUrl: env.OTEL_METRICS_EXPORTER_URL || undefined,
    },
  };

  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`Configuration invalid: ${parsed.error.message}. Remediation: check environment variables`);
  }

  const rawConfig: AppConfig = {
    databaseUrl: parsed.data.databaseUrl,
    databaseUrlSource: resolvedDatabaseUrl.source,
    app: {
      origin: (parsed.data.app.origin as string) ?? null,
      corsOrigins: parsed.data.app.corsOrigins,
      env: (isProduction ? "production" : nodeEnv === "test" ? "test" : "development") as any,
    },
    worker: {
      pollIntervalMs: parsed.data.worker.pollIntervalMs,
      batchSize: parsed.data.worker.batchSize,
      leaseSeconds: parsed.data.worker.leaseSeconds,
      maxAttempts: parsed.data.worker.maxAttempts,
      shutdownSeconds: parsed.data.worker.shutdownSeconds,
    },
    foundation: {
      demoEnabled: parsed.data.foundation.demoEnabled,
    },
    log: {
      level: parsed.data.log.level as any,
    },
    otel: {
      tracesUrl: parsed.data.otel.tracesUrl,
      metricsUrl: parsed.data.otel.metricsUrl,
    },
  };

  const config = {} as AppConfig;

  Object.defineProperty(config, "databaseUrl", {
    value: rawConfig.databaseUrl,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(config, "databaseUrlSource", {
    value: rawConfig.databaseUrlSource,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(config, "toJSON", {
    value: function () {
      return {
        app: (this as AppConfig).app,
        worker: (this as AppConfig).worker,
        foundation: (this as AppConfig).foundation,
        log: (this as AppConfig).log,
        otel: (this as AppConfig).otel,
        databaseUrl: "[REDACTED]",
      };
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });

  Object.defineProperties(config, {
    app: { value: Object.freeze(rawConfig.app), enumerable: true, writable: false, configurable: false },
    worker: { value: Object.freeze(rawConfig.worker), enumerable: true, writable: false, configurable: false },
    foundation: { value: Object.freeze(rawConfig.foundation), enumerable: true, writable: false, configurable: false },
    log: { value: Object.freeze(rawConfig.log), enumerable: true, writable: false, configurable: false },
    otel: { value: Object.freeze(rawConfig.otel), enumerable: true, writable: false, configurable: false },
  });

  Object.freeze(config.app.corsOrigins);
  Object.freeze(config);

  return config;
}

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
