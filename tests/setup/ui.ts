import "@testing-library/jest-dom/vitest";
import { beforeAll } from "vitest";

beforeAll(() => {
  (process.env as Record<string, string>).NODE_ENV = "test";
});
