/**
 * Config check shell - validates DATABASE_URL presence.
 * Phase 1 shell; Phase 2 will implement full typed config validation.
 */
const required = ["DATABASE_URL"];
const missing: string[] = [];

for (const key of required) {
  if (!process.env[key]) {
    missing.push(key);
  }
}

if (missing.length > 0) {
  console.error(`Missing required config: ${missing.join(", ")}`);
  console.error(`Remediation: set ${missing[0]} in .env.local or environment`);
  process.exit(1);
}

console.log("Config check passed");
