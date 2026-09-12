#!/usr/bin/env node
/**
 * Test policy: reject .skip, .only, todo, placeholder assertions outside allow-list.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = process.cwd();
const TEST_DIRS = ["tests", "src"];
const ALLOW_LIST = [
  "node_modules",
  ".next",
  "coverage",
  "playwright-report",
  "test-results",
  "dist",
];

const FORBIDDEN_PATTERNS = [
  { regex: /\.skip\s*\(/, msg: ".skip found" },
  { regex: /\.only\s*\(/, msg: ".only found" },
  { regex: /\btest\.todo\s*\(/, msg: "test.todo found" },
  { regex: /\bit\.todo\s*\(/, msg: "it.todo found" },
  { regex: /\bdescribe\.todo\s*\(/, msg: "describe.todo found" },
  { regex: /assert\s*\(\s*true\s*\)/, msg: "placeholder assert(true) found" },
  { regex: /expect\s*\(\s*true\s*\)\.toBe\s*\(\s*true\s*\)/, msg: "placeholder expect(true).toBe(true) found" },
];

let failures = [];

function walk(dir) {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return;
  const entries = readdirSync(dir);
  for (const entry of entries) {
    if (ALLOW_LIST.includes(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      walk(full);
    } else {
      const ext = extname(full);
      if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) continue;
      // Skip fixtures that intentionally violate rules
      if (full.includes("tests/architecture/fixtures")) continue;
      const content = readFileSync(full, "utf8");
      for (const { regex, msg } of FORBIDDEN_PATTERNS) {
        if (regex.test(content)) {
          // Find line numbers
          const lines = content.split("\n");
          lines.forEach((line, idx) => {
            if (regex.test(line)) {
              failures.push(`${full}:${idx + 1} - ${msg}: ${line.trim().slice(0, 120)}`);
            }
          });
        }
      }
    }
  }
}

for (const d of TEST_DIRS) {
  walk(join(ROOT, d));
}

if (failures.length > 0) {
  console.error("Test policy violations:");
  failures.forEach((f) => console.error(" -", f));
  process.exit(1);
} else {
  console.log("Test policy passed: no .skip/.only/todo/placeholder assertions");
  process.exit(0);
}
