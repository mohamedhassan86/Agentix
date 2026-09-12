import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  (process.env as Record<string, string>).NODE_ENV = "test";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5432/agentix_test";
});

afterAll(() => {
  // cleanup if needed
});
