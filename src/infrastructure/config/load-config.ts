import { configSchema, parseCorsOrigins } from "./schema";
import { describeDatabaseUrls, resolveDatabaseUrls, type DatabaseRuntimeInfo } from "./database-url";

/**
 * A missing/invalid environment is an operational dependency problem, not a code bug:
 * carrying status/code/dependency lets the route answer problem+json (and keeps
 * /health/ready conformant to its own contract) instead of a bare 500 that the status
 * banner can only report as "Dependency unknown unavailable".
 */
export type ConfigDependency = "database" | "schema";

export interface ConfigErrorOptions {
  /** Only set when the problem is a health dependency, so problem+json stays valid. */
  dependency?: ConfigDependency;
  code?: "CONFIG_MISSING" | "CONFIG_INVALID";
  detail?: string;
}

export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly status = 503;
  readonly code: "CONFIG_MISSING" | "CONFIG_INVALID";
  readonly dependency?: ConfigDependency;
  readonly detail: string;

  constructor(message: string, options: ConfigErrorOptions = {}) {
    super(message);
    this.code = options.code ?? "CONFIG_INVALID";
    this.dependency = options.dependency;
    this.detail =
      options.detail ??
      "Required configuration is missing or invalid in this deployment environment. " +
        "Check Project -> Settings -> Environment Variables for this environment (Production and Preview are separate).";
  }
}

export interface AppConfig {
  databaseUrl: string;
  /** Credential-free facts about how the connection string was resolved. */
  database: DatabaseRuntimeInfo;
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
  // DATABASE_URL is the canonical name; Vercel's Postgres/Neon integration injects
  // POSTGRES_* instead, so resolveDatabaseUrls() accepts both before failing.
  let database: DatabaseRuntimeInfo;
  let databaseUrl: string;
  try {
    const resolved = resolveDatabaseUrls(env);
    databaseUrl = resolved.appUrl;
    database = describeDatabaseUrls(resolved);
  } catch (e) {
    throw new ConfigError(`DATABASE_URL is required (or a platform equivalent). Remediation: ${(e as Error).message}`, {
      dependency: "database",
      code: "CONFIG_MISSING",
      detail:
        "No PostgreSQL connection string is available to this deployment. The Vercel Postgres/Neon " +
        "integration injects POSTGRES_URL and friends - make sure they are enabled for this environment.",
    });
  }

  const nodeEnv = env.NODE_ENV ?? "development";
  const isProduction = nodeEnv === "production";

  let appOrigin: string | null = null;
  if (isProduction) {
    const origin = env.APP_ORIGIN;
    if (!origin) {
      throw new ConfigError(
        "APP_ORIGIN is required in production. Remediation: set APP_ORIGIN to the exact origin URL (e.g. https://example.com) in environment."
      );
    }
    try {
      const url = new URL(origin);
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
    _database: database,
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

  const rawConfig: Omit<AppConfig, "database"> = {
    databaseUrl: parsed.data.databaseUrl,
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

  Object.defineProperty(config, "database", {
    value: Object.freeze({ ...database }),
    enumerable: true,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(config, "databaseUrl", {
    value: rawConfig.databaseUrl,
    enumerable: false,
    writable: false,
    configurable: false,
  });

  Object.defineProperty(config, "toJSON", {
    value: function () {
      return {
        database: (this as AppConfig).database,
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
