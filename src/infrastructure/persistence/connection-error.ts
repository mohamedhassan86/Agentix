/**
 * Classification of low-level PostgreSQL/Node connection failures.
 *
 * Raw driver error messages can echo hostnames, ports and user names, and this
 * codebase must never leak connection details into responses, logs or spans
 * (constitution: "zero leakage"). So we map an unknown error onto a stable
 * category plus a remediation string, and expose only those.
 */

export type ConnectionFailureCategory =
  | "missing_config"
  | "dns_not_resolved"
  | "connection_refused"
  | "connect_timeout"
  | "pool_acquired_timeout"
  | "auth_failed"
  | "ip_not_allowed"
  | "database_not_found"
  | "tls_required"
  | "tls_handshake_failed"
  | "too_many_connections"
  | "schema_not_migrated"
  | "edge_runtime_unsupported"
  | "unknown";

export interface ClassifiedFailure {
  category: ConnectionFailureCategory;
  /** Stable machine code (Node errno or SQLSTATE). Never contains secrets. */
  code: string;
  /** Human remediation, safe to log and to return from /health/ready. */
  remediation: string;
}

interface ErrorLike {
  message?: string;
  code?: string;
  name?: string;
  syscall?: string;
  errno?: number;
}

const REMEDIATION: Record<ConnectionFailureCategory, string> = {
  missing_config:
    "No PostgreSQL URL in the environment. Add DATABASE_URL (or rely on the Vercel Postgres/Neon POSTGRES_URL fallback) in Project → Settings → Environment Variables for Production AND Preview, then redeploy.",
  dns_not_resolved:
    "The database hostname cannot be resolved. Check the host in DATABASE_URL/POSTGRES_URL (a Vercel Postgres host ends in postgres.vercel-storage.com or aws.neon.tech) and that the value was not truncated or wrapped in quotes when pasted.",
  connection_refused:
    "Nothing is listening on that host/port. For hosted Postgres you must use the pooled endpoint (POSTGRES_URL / POSTGRES_PRISMA_URL), not a localhost or private-network address; localhost databases are unreachable from Vercel.",
  connect_timeout:
    "Connecting exceeded the timeout. Hosted Postgres cold-starts (Neon autosuspend) can take several seconds: raise DB_CONNECTION_TIMEOUT_MS (default 10000) and retry; also confirm the pooled endpoint is used.",
  pool_acquired_timeout:
    "No free connection in the pool. Lower DB_POOL_MAX when using a PgBouncer pooler (transaction pooling) and make sure transactions are short; add connection_limit=1 to the Prisma pooled URL.",
  auth_failed:
    "Authentication failed for that user/password. Re-copy the connection string from the Vercel storage dashboard; URL-encode special characters in the password (@ → %40, / → %2F, # → %23).",
  ip_not_allowed:
    "The server rejected the client (pg_hba / branch protection). Disable IP allow-lists for the database or add Vercel egress ranges; Neon/Vercel Postgres do not need an allow-list by default.",
  database_not_found:
    "The database in the connection string does not exist. Verify the path segment of the URL matches the database created by the integration.",
  tls_required:
    "The server requires TLS. Add ?sslmode=require to the connection string (this app already does so automatically for remote hosts) — plain connections are rejected by Vercel Postgres/Neon.",
  tls_handshake_failed:
    "TLS handshake or certificate verification failed. pg maps sslmode=require to full verification: if the endpoint certificate " +
      "does not match its hostname (common with poolers), set DB_SSL_NO_VERIFY=true outside production, or supply the CA with " +
      "sslrootcert. Never disable verification in production.",
  too_many_connections:
    "The database reached its connection limit. Use the pooled endpoint, reduce DB_POOL_MAX, and keep DB_IDLE_TIMEOUT_MS low so frozen serverless functions release connections.",
  schema_not_migrated:
    "Database is reachable but the schema is not applied. Run `prisma migrate deploy` against the non-pooled URL (POSTGRES_URL_NON_POOLING / DATABASE_URL_UNPOOLED) — migrations must not run through a PgBouncer pooler.",
  edge_runtime_unsupported:
    "This route ran on the Edge runtime, which cannot open TCP sockets to Postgres. Set `export const runtime = \"nodejs\"` on the route (Prisma + pg require Node).",
  unknown:
    "Unhandled database connection failure. Enable LOG_LEVEL=debug and read the category/code fields; do not log the connection string.",
};

const SQLSTATE_CATEGORY: Record<string, ConnectionFailureCategory> = {
  "28P01": "auth_failed",
  "28000": "ip_not_allowed",
  "3D000": "database_not_found",
  "53300": "too_many_connections",
  "42P01": "schema_not_migrated",
  "08001": "tls_required",
  "08003": "connection_refused",
  "08006": "tls_handshake_failed",
  "57P01": "connection_refused",
};

const ALL_CATEGORIES = Object.keys(REMEDIATION) as ConnectionFailureCategory[];

/** True when a free-form probe message is one of our stable categories. */
export function isConnectionFailureCategory(value: string): value is ConnectionFailureCategory {
  return (ALL_CATEGORIES as string[]).includes(value);
}

/** Static remediation text for a known failure category (safe: no host, no user). */
export function remediationFor(category: ConnectionFailureCategory): string {
  return REMEDIATION[category] ?? REMEDIATION.unknown;
}

export function classifyConnectionError(error: unknown): ClassifiedFailure {
  const err = (error ?? {}) as ErrorLike & Record<string, unknown>;
  const message = typeof err.message === "string" ? err.message : "";
  const lower = message.toLowerCase();
  const code = typeof err.code === "string" ? err.code : "UNKNOWN";

  // Some drivers (pg's TLS/socket layer) put the errno in the message instead of `code`.
  const NET_CODES = [
    "ENOTFOUND",
    "EAI_AGAIN",
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "EPIPE",
  ] as const;
  const effectiveCode =
    code === "UNKNOWN"
      ? NET_CODES.find((token) => lower.includes(token.toLowerCase())) ?? code
      : code;

  let category: ConnectionFailureCategory | null = null;

  if (["ENOTFOUND", "EAI_AGAIN", "ENETUNREACH", "EHOSTUNREACH"].includes(effectiveCode)) {
    category = "dns_not_resolved";
  } else if (effectiveCode === "ECONNREFUSED" || lower.includes("connection terminated")) {
    category = "connection_refused";
  } else if (lower.includes("no pg_hba.conf entry") || lower.includes("ip allow list") || lower.includes("access denied")) {
    category = "ip_not_allowed";
  } else if (effectiveCode === "ETIMEDOUT" || lower.includes("timeout exceeded") || lower.includes("timed out")) {
    category = lower.includes("acquir") ? "pool_acquired_timeout" : "connect_timeout";
  } else if (lower.includes("self-signed certificate") || lower.includes("unable to verify")) {
    category = "tls_handshake_failed";
  } else if (lower.includes("does not support ssl") || lower.includes("server does not have ssl enabled")) {
    category = "tls_required";
  } else if (effectiveCode === "ECONNRESET" || effectiveCode === "EPIPE" || lower.includes("before secure tls connection")) {
    category = "tls_handshake_failed";
  } else if (SQLSTATE_CATEGORY[effectiveCode]) {
    category = SQLSTATE_CATEGORY[effectiveCode];
  } else if (lower.includes("password authentication failed")) {
    category = "auth_failed";
  } else if (lower.includes("too many clients") || lower.includes("remaining connection slots")) {
    category = "too_many_connections";
  } else if (lower.includes("relation \"") && lower.includes("does not exist")) {
    category = "schema_not_migrated";
  } else if (lower.includes("undefined table") || lower.includes("_prisma_migrations")) {
    category = "schema_not_migrated";
  } else if (lower.includes("is required")) {
    category = "missing_config";
  } else if (lower.includes("edge runtime") || lower.includes("tcp")) {
    category = "edge_runtime_unsupported";
  } else if (code.startsWith("P1001") || code.startsWith("P1003")) {
    category = "connection_refused";
  } else if (code.startsWith("P2021") || code.startsWith("P3014")) {
    category = "schema_not_migrated";
  }

  if (!category && SQLSTATE_CATEGORY[effectiveCode.slice(0, 5)]) {
    category = SQLSTATE_CATEGORY[effectiveCode.slice(0, 5)];
  }

  const finalCategory = category ?? "unknown";
  return {
    category: finalCategory,
    code: effectiveCode,
    remediation: REMEDIATION[finalCategory] ?? REMEDIATION.unknown,
  };
}
