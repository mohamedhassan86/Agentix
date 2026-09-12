import pino, { type Logger as PinoLogger, type LoggerOptions } from "pino";
import { redactObject } from "./redaction";

export interface TestSink {
  logs: unknown[];
  write(obj: unknown): void;
  getLogs(): unknown[];
}

export function createTestSink(): TestSink {
  const logs: unknown[] = [];
  return {
    logs,
    write(obj: unknown) {
      logs.push(obj);
    },
    getLogs() {
      return logs;
    },
  };
}

function safeSerializer(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: "[REDACTED]",
      stack: undefined,
    };
  }
  return { error: "[REDACTED]" };
}

export function createLogger(options: {
  level?: string;
  sink?: { write: (obj: unknown) => void } | NodeJS.WritableStream;
  redactSensitive?: boolean;
}): PinoLogger {
  const level = options.level ?? process.env.LOG_LEVEL ?? "info";

  const pinoOptions: LoggerOptions = {
    level,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: undefined, // no pid/hostname by default for cleaner logs
    serializers: {
      err: safeSerializer,
      error: safeSerializer,
    },
    // Do not log request/response bodies by default
    // Redaction for known sensitive fields
    redact: {
      paths: [
        "password",
        "passwd",
        "secret",
        "token",
        "authorization",
        "cookie",
        "key",
        "connection",
        "database_url",
        "DATABASE_URL",
        "api_key",
        "apikey",
        "access_token",
        "refresh_token",
        "*.password",
        "*.secret",
        "*.token",
        "*.authorization",
        "*.cookie",
        "*.key",
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers.authorization",
      ],
      remove: false,
    },
  };

  let destination: pino.DestinationStream | undefined;
  if (options.sink) {
    if ("write" in options.sink && typeof (options.sink as any).write === "function") {
      // Custom sink for tests
      const sink = options.sink as { write: (obj: unknown) => void };
      destination = {
        write: (chunk: string) => {
          try {
            const obj = JSON.parse(chunk);
            // Apply recursive redaction
            const redacted = redactObject(obj);
            sink.write(redacted);
          } catch {
            sink.write({ raw: chunk });
          }
        },
      } as any;
    } else {
      destination = options.sink as NodeJS.WritableStream as any;
    }
  }

  const logger = destination ? pino(pinoOptions, destination) : pino(pinoOptions);

  return logger;
}

// Global logger instance
let globalLogger: PinoLogger | null = null;

export function getLogger(): PinoLogger {
  if (!globalLogger) {
    globalLogger = createLogger({});
  }
  return globalLogger;
}

export function setGlobalLogger(logger: PinoLogger): void {
  globalLogger = logger;
}
