/**
 * PostgreSQL connection-string resolution for local, CI and platform deploys.
 *
 * Why this exists: the app used to read only `DATABASE_URL`, but the Vercel
 * Postgres / Neon integration injects `POSTGRES_URL`, `POSTGRES_PRISMA_URL` and
 * `POSTGRES_URL_NON_POOLING` (newer Neon-provisioned projects use
 * `DATABASE_URL` / `DATABASE_URL_UNPOOLED`). Without this mapping the app boots
 * with "DATABASE_URL is required" even though the database is connected.
 *
 * Rules:
 *  - runtime (app) traffic prefers the *pooled* endpoint (serverless-safe)
 *  - migrations/DDL must use the *direct* (non-pooled) endpoint, because PgBouncer
 *    in transaction mode rejects parts of `prisma migrate deploy`
 *    (e.g. `CREATE TYPE ... cannot run inside a transaction block`)
 *  - remote endpoints always get TLS (`sslmode=require`) unless explicitly disabled
 *  - connection strings are never returned in logs: use `redactConnectionString`
 */

export type Env = Record<string, string | undefined>;

/** Ordered by preference for runtime use. First non-empty wins. */
export const APP_URL_ENV_VARS = [
  "DATABASE_URL",
  "POSTGRES_URL",
  "POSTGRES_PRISMA_URL",
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
] as const;

/** Ordered by preference for `prisma migrate` / DDL. First non-empty wins. */
export const DIRECT_URL_ENV_VARS = [
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL_UNPOOLED",
  "DIRECT_URL",
  "DATABASE_URL_DIRECT",
] as const;

export interface ResolvedDatabaseUrls {
  /** Connection string used by the app at runtime. */
  appUrl: string;
  /** Name of the env var `appUrl` was taken from (never the value). */
  appUrlSource: string;
  /** Direct, non-pooled endpoint for migrations; null when only one endpoint exists. */
  directUrl: string | null;
  directUrlSource: string | null;
  /** True when `appUrl` points at a transaction pooler (PgBouncer / `-pooler` host). */
  usesPooler: boolean;
  /** True when TLS was enforced by us rather than requested by the operator. */
  tlsForced: boolean;
}

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "host.docker.internal",
  "postgres",
  "db",
]);

function firstPresent(env: Env, names: readonly string[]): { key: string; value: string } | null {
  for (const name of names) {
    const raw = env[name];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return { key: name, value: raw.trim() };
    }
  }
  return null;
}

function isConnectionString(value: string): boolean {
  return /^postgres(ql)?:\/\//i.test(value);
}

/** Parse a connection string; returns null for anything we cannot introspect. */
function parse(raw: string): URL | null {
  if (!isConnectionString(raw)) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function looksLikePooler(raw: string): boolean {
  const url = parse(raw);
  if (!url) {
    // Fall back to textual hints for non-URL style configs.
    return /pooler/i.test(raw) || /pgbouncer=true/i.test(raw);
  }
  const host = url.hostname.toLowerCase();
  if (host.includes("pooler")) return true;
  const pgbouncer = url.searchParams.get("pgbouncer");
  return pgbouncer === "true" || pgbouncer === "1";
}

/**
 * Replace the query string of a connection string without letting WHATWG URL
 * normalisation touch the path (a trailing "/" would be read as a database name).
 */
function withQueryString(raw: string, params: URLSearchParams): string {
  const query = params.toString();
  const cut = raw.indexOf("?");
  const base = cut === -1 ? raw : raw.slice(0, cut);
  return query.length > 0 ? `${base}?${query}` : base;
}

export interface TlsOutcome {
  url: string;
  forced: boolean;
}

/**
 * Ensure a remote endpoint uses TLS. `sslmode=disable|allow|prefer` is upgraded to
 * `require`. Escape hatches, both refused in production:
 *  - `DB_ALLOW_INSECURE_TLS=true`  no TLS at all (self-signed local proxy)
 *  - `DB_SSL_NO_VERIFY=true`       TLS without certificate verification, for a pooler whose
 *    certificate does not match its hostname (pg treats `require` as `verify-full`)
 */
export function ensureTls(raw: string, env: Env = process.env): TlsOutcome {
  const url = parse(raw);
  if (!url) return { url: raw, forced: false };

  const isProduction = env.NODE_ENV === "production";
  const flag = (name: string) => env[name] === "true" || env[name] === "1";
  const allowInsecure = !isProduction && flag("DB_ALLOW_INSECURE_TLS");
  const skipVerify = !isProduction && flag("DB_SSL_NO_VERIFY");

  const host = url.hostname.toLowerCase();
  const isLocal = LOCAL_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal");
  if (isLocal && !skipVerify) return { url: raw, forced: false };
  if (allowInsecure) return { url: raw, forced: false };

  const params = new URLSearchParams(url.search);
  const sslmode = (params.get("sslmode") ?? "").toLowerCase();
  if (skipVerify) {
    if (sslmode === "no-verify") return { url: raw, forced: false };
    params.set("sslmode", "no-verify");
    return { url: withQueryString(raw, params), forced: true };
  }
  if (sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full" || sslmode === "no-verify") {
    return { url: raw, forced: false };
  }
  if (params.get("ssl") === "false" && sslmode === "") {
    params.delete("ssl");
  }
  params.set("sslmode", "require");
  return { url: withQueryString(raw, params), forced: true };
}

export function redactConnectionString(raw: string): string {
  const url = parse(raw);
  if (!url) return "<unparseable connection string>";
  const host = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  const user = url.username ? `${url.username}@` : "";
  const database = url.pathname.replace(/^\//, "") || "(no database)";
  const params = new URLSearchParams(url.search);
  if (params.has("password")) params.set("password", "***");
  const query = params.toString();
  return `postgres://${user}${host}/${database}${query ? `?${query}` : ""}`;
}

/**
 * Resolve runtime + migration connection strings from the environment.
 * Throws a remediation-oriented error that never echoes a secret value.
 */
export function resolveDatabaseUrls(env: Env = process.env): ResolvedDatabaseUrls {
  const app = firstPresent(env, APP_URL_ENV_VARS);
  if (!app) {
    throw new Error(
      "No PostgreSQL connection string found. Remediation: set one of " +
        `${APP_URL_ENV_VARS.join(", ")} in your environment. On Vercel, the Postgres/Neon ` +
        "integration injects POSTGRES_* variables but not DATABASE_URL — either add a " +
        "DATABASE_URL secret pointing at the pooled URL, or let the app fall back to POSTGRES_URL. " +
        "In the Vercel dashboard: Project → Settings → Environment Variables (or `vercel env ls`).",
    );
  }

  const tls = ensureTls(app.value, env);
  const direct = firstPresent(env, DIRECT_URL_ENV_VARS);

  let directUrl: string | null = direct ? direct.value : null;
  let directUrlSource: string | null = direct ? direct.key : null;

  // If the runtime var already is the direct endpoint, migrations can reuse it.
  if (!directUrl && !looksLikePooler(tls.url)) {
    directUrl = tls.url;
    directUrlSource = app.key;
  }

  return {
    appUrl: tls.url,
    appUrlSource: app.key,
    directUrl,
    directUrlSource,
    usesPooler: looksLikePooler(tls.url),
    tlsForced: tls.forced,
  };
}

export interface DatabaseRuntimeInfo {
  /** Env var name the runtime connection string came from. */
  source: string;
  usesPooler: boolean;
  tlsForced: boolean;
  /** Whether a separate non-pooled endpoint is available for migrations. */
  hasDirectUrl: boolean;
  /** Env var the direct endpoint came from, when known. */
  directSource: string | null;
  /** Credential-free connection string, safe to log or return from diagnostics. */
  redacted: string;
}

export function describeDatabaseUrls(resolved: ResolvedDatabaseUrls): DatabaseRuntimeInfo {
  return {
    source: resolved.appUrlSource,
    usesPooler: resolved.usesPooler,
    tlsForced: resolved.tlsForced,
    hasDirectUrl: resolved.directUrl !== null,
    directSource: resolved.directUrlSource,
    redacted: redactConnectionString(resolved.appUrl),
  };
}

export interface PoolTuning {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  statementTimeoutMs: number | undefined;
}

function intFromEnv(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

/**
 * Serverless-aware pool defaults. `max: 10` per function instance against a
 * PgBouncer pooler is the classic "too many clients" / prepared-statement failure,
 * and a 2s connect timeout is shorter than a cold Neon endpoint wake-up.
 */
export function poolTuning(usesPooler: boolean, env: Env = process.env): PoolTuning {
  const statement = env.DB_STATEMENT_TIMEOUT_MS ? intFromEnv(env, "DB_STATEMENT_TIMEOUT_MS", 0) : 0;
  return {
    max: intFromEnv(env, "DB_POOL_MAX", usesPooler ? 3 : 10),
    connectionTimeoutMillis: intFromEnv(env, "DB_CONNECTION_TIMEOUT_MS", 10_000),
    idleTimeoutMillis: intFromEnv(env, "DB_IDLE_TIMEOUT_MS", usesPooler ? 10_000 : 30_000),
    statementTimeoutMs: statement > 0 ? statement : undefined,
  };
}
