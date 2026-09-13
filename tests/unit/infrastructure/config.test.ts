import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig, ConfigError } from "@/infrastructure/config/load-config";

describe("fail-fast immutable config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("requires DATABASE_URL", () => {
    delete process.env.DATABASE_URL;
    expect(() => loadConfig()).toThrow(ConfigError);
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
  });

  it("fails fast with setting name and remediation, no secret value", () => {
    delete process.env.DATABASE_URL;
    try {
      loadConfig();
    } catch (e) {
      const err = e as Error;
      expect(err.message).toMatch(/DATABASE_URL/);
      expect(err.message).not.toContain("postgres://");
      // Should contain remediation hint
      expect(err.message.toLowerCase()).toMatch(/remediation|set|configure/);
    }
  });

  it("validates bounded worker settings 1-10", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    process.env.WORKER_MAX_ATTEMPTS = "15";
    expect(() => loadConfig()).toThrow(/max attempts|bounded/i);
    process.env.WORKER_MAX_ATTEMPTS = "0";
    expect(() => loadConfig()).toThrow();
    process.env.WORKER_MAX_ATTEMPTS = "3";
    const cfg = loadConfig();
    expect(cfg.worker.maxAttempts).toBe(3);
  });

  it("requires APP_ORIGIN in production", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-minimum-length!!";
    process.env.MESSAGE_DELIVERY_KEY = "test-message-delivery-key-32-chars-min!!";
    delete process.env.APP_ORIGIN;
    expect(() => loadConfig()).toThrow(/APP_ORIGIN/);
    process.env.APP_ORIGIN = "https://example.com";
    const cfg = loadConfig();
    expect(cfg.app.origin).toBe("https://example.com");
  });

  it("parses exact-origin CORS", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as Record<string, string>).NODE_ENV = "development";
    process.env.CORS_ORIGINS = "https://example.com, https://app.example.com";
    const cfg = loadConfig();
    expect(cfg.app.corsOrigins).toEqual(["https://example.com", "https://app.example.com"]);
  });

  it("returns immutable config", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as Record<string, string>).NODE_ENV = "development";
    const cfg = loadConfig();
    expect(() => {
      (cfg as any).databaseUrl = "changed";
    }).toThrow();
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  it("never exposes secret values in safe config", () => {
    process.env.DATABASE_URL = "postgresql://user:supersecret@localhost:5432/test";
    (process.env as Record<string, string>).NODE_ENV = "development";
    const cfg = loadConfig();
    const json = JSON.stringify(cfg);
    expect(json).not.toContain("supersecret");
  });

  it("production demo disabled by default", () => {
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.APP_ORIGIN = "https://example.com";
    process.env.AUTH_SECRET = "test-auth-secret-32-chars-minimum-length!!";
    process.env.MESSAGE_DELIVERY_KEY = "test-message-delivery-key-32-chars-min!!";
    delete process.env.FOUNDATION_DEMO_ENABLED;
    const cfg = loadConfig();
    expect(cfg.foundation.demoEnabled).toBe(false);
  });
});
