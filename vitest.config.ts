import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@/domain": path.resolve(__dirname, "src/domain"),
      "@/application": path.resolve(__dirname, "src/application"),
      "@/infrastructure": path.resolve(__dirname, "src/infrastructure"),
      "@/app": path.resolve(__dirname, "src/app"),
      "@/worker": path.resolve(__dirname, "src/worker"),
    },
  },
  test: {
    globals: true,
    testTimeout: 15000,
    hookTimeout: 15000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/index.ts",
        "src/app/**/route.ts",
        "src/app/**/layout.tsx",
        "src/app/**/page.tsx",
        "src/generated/**",
        "tests/**",
      ],
      thresholds: {
        // Constitution floors enforced per layer when files exist
        // Global floors are permissive in foundation to allow incremental growth
        lines: 0,
        branches: 0,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
          environment: "node",
          setupFiles: ["tests/setup/unit.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          setupFiles: ["tests/setup/integration.ts"],
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          include: ["tests/unit/ui/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/setup/ui.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "architecture",
          include: ["tests/architecture/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "contract",
          include: ["tests/contract/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
