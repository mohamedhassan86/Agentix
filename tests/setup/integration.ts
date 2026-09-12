import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  (process.env as Record<string, string>).NODE_ENV = "test";
  // Integration tests use Testcontainers or DATABASE_URL if provided
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/agentix_test";
  // Ensure no secret leakage in test env
  process.env.APP_ORIGIN = process.env.APP_ORIGIN ?? "http://localhost:3000";
});

afterAll(() => {
  // Global integration cleanup
});
