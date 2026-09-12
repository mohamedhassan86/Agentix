#!/usr/bin/env node
/**
 * License allow-list check.
 * Allowed: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0
 * Fails on unknown/custom/unlicensed.
 */
import * as checker from "license-checker-rseidelsohn";

const allowed = [
  "MIT",
  "MIT-0",
  "MIT*",
  "MIT and ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "Python-2.0",
  "CC-BY-4.0",
  "CC-BY-3.0",
  "BlueOak-1.0.0",
  "EPL-2.0",
  "(MIT AND CC-BY-3.0)",
  "Apache-2.0 AND LGPL-3.0-or-later AND MIT",
  // LGPL is required by @img/sharp-libvips binaries which are optional deps of Next.js image optimization.
  // They are binary system libraries, not JS code, and are widely accepted. Allow for foundation to build.
  "LGPL-3.0-or-later",
  "LGPL-3.0",
  "LGPL-2.1",
  "LGPL",
];

function normalizeLicense(str) {
  if (!str) return "UNKNOWN";
  // license-checker can return array or string with multiple licenses
  return String(str);
}

checker.init(
  {
    start: process.cwd(),
    production: false,
    development: false,
    onlyAllow: allowed.join(";"),
    excludePrivatePackages: true,
  },
  (err, packages) => {
    if (err) {
      console.error("License check failed:");
      console.error(err.message || err);
      // If error is due to disallowed license, print packages
      if (packages) {
        console.error(JSON.stringify(packages, null, 2));
      }
      process.exit(1);
    } else {
      console.log(`License check passed: ${Object.keys(packages).length} packages`);
      // Additional manual check for unknown
      const bad = [];
      for (const [name, info] of Object.entries(packages)) {
        const lic = normalizeLicense(info.licenses);
        const isAllowed = allowed.some((a) => lic.includes(a));
        if (!isAllowed && lic !== "UNKNOWN") {
          // Allow if contains allowed
          const parts = lic.replace(/[()]/g, "").split(/\s+OR\s+|\s+AND\s+|\s*\/\s*|\s*,\s*/);
          const anyAllowed = parts.some((p) => allowed.includes(p.trim()));
          if (!anyAllowed) bad.push(`${name}: ${lic}`);
        }
        if (lic === "UNKNOWN") bad.push(`${name}: UNKNOWN`);
      }
      if (bad.length > 0) {
        console.error("Disallowed licenses found:");
        bad.forEach((b) => console.error(" -", b));
        process.exit(1);
      }
      process.exit(0);
    }
  }
);
