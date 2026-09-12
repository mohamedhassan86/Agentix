import { configSchema, parseCorsOrigins } from "./schema";

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface AppConfig {
  databaseUrl: string;
  app: {
    origin: string | null;
    corsOrigins: string[];
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
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new ConfigError(
      "DATABASE_URL is required. Remediation: set DATABASE_URL to a valid PostgreSQL connection string in .env.local or environment. Value must not be logged."
    );
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
    app: {
      origin: (parsed.data.app.origin as string) ?? null,
      corsOrigins: parsed.data.app.corsOrigins,
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
