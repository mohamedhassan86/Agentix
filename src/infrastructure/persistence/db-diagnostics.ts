import type { ReadinessReason } from "@/application/shared/ports/readiness-probe";
import { dependencyForReason } from "@/application/shared/ports/readiness-probe";

/**
 * Classification of Postgres / socket / Prisma failures into the closed readiness reason set.
 * Only stable machine codes are read - never `error.message`, which can embed the host,
 * the role, or an entire connection string.
 */

export interface DatabaseFailureClassification {
  dependency: "database" | "schema";
  reason: ReadinessReason;
  /** SQLSTATE (Postgres), Prisma code, or driver errno; safe to log, never a credential. */
  driverCode?: string;
  /** @deprecated kept for existing callers; equals driverCode for SQLSTATE failures. */
  sqlState?: string;
}

/** Node socket errno -> reason (a failure to reach the server at all). */
const SOCKET_REASONS: Record<string, ReadinessReason> = {
  ECONNREFUSED: "connection_refused",
  // TLS handshake against a server that expects TLS (or a plaintext endpoint that is not
  // Postgres at all). `pg` surfaces this without a SQLSTATE.
  EPROTO: "tls_handshake_failed",
  ERR_SSL_WRONG_VERSION_NUMBER: "tls_handshake_failed",
  ERR_SSL_PACKET_LENGTH_TOO_LONG: "tls_handshake_failed",
  ERR_SSL_UNSUPPORTED_PROTOCOL: "tls_handshake_failed",
  ERR_SSL_TLSV1_ALERT_UNKNOWN_CA: "tls_verification_failed",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "tls_verification_failed",
  SELF_SIGNED_CERT_IN_CHAIN: "tls_verification_failed",
  DEPTH_ZERO_SELF_SIGNED_CERT: "tls_verification_failed",
  CERT_HAS_EXPIRED: "tls_verification_failed",
  ERR_TLS_CERT_ALTNAME_INVALID: "tls_verification_failed",
  ENOTFOUND: "connection_refused",
  EAI_AGAIN: "connection_refused",
  EHOSTUNREACH: "connection_refused",
  ENETUNREACH: "connection_refused",
  ETIMEDOUT: "connection_timeout",
  ESOCKETTIMEDOUT: "connection_timeout",
  ECONNRESET: "connection_failed",
  EPIPE: "connection_failed",
};

/** Postgres SQLSTATE -> reason. */
const SQLSTATE_REASONS: Record<string, ReadinessReason> = {
  // Connection exceptions (class 08)
  "08000": "connection_failed",
  "08001": "connection_failed",
  "08003": "connection_failed",
  "08004": "connection_refused",
  "08006": "connection_failed",
  "08007": "connection_failed",
  "08P01": "connection_failed",
  // Invalid authorization specification / invalid password
  "28000": "authentication_failed",
  "28P01": "authentication_failed",
  // Invalid catalog name (database does not exist)
  "3D000": "database_missing",
  // Insufficient resources
  "53300": "too_many_connections",
  "53400": "too_many_connections",
  // Operator intervention / shutdown
  "57P01": "server_unavailable",
  "57P02": "server_unavailable",
  "57P03": "server_unavailable",
  "57P04": "server_unavailable",
  // Probe statement cancelled (statement_timeout)
  "57014": "connection_timeout",
  // Undefined table / undefined schema (e.g. missing _prisma_migrations)
  "42P01": "migration_table_missing",
  "3F000": "migration_table_missing",
};

/** Prisma error codes -> reason, for failures raised through the ORM client. */
const PRISMA_REASONS: Record<string, ReadinessReason> = {
  P1000: "authentication_failed",
  P1001: "connection_refused",
  P1002: "connection_timeout",
  P1003: "database_missing",
  P1008: "connection_timeout",
  P1010: "authentication_failed",
  P1017: "connection_failed",
  P2021: "migration_table_missing",
};

function readErrorCode(error: unknown): { sqlState?: string; prismaCode?: string; errno?: string } {
  if (!error || typeof error !== "object") return {};
  const candidate = error as { code?: unknown; errno?: unknown; cause?: { code?: unknown } };
  const direct = typeof candidate.code === "string" ? candidate.code : undefined;
  const nested = typeof candidate.cause?.code === "string" ? candidate.cause.code : undefined;
  const errno = typeof candidate.errno === "string" ? candidate.errno : undefined;

  for (const code of [direct, nested]) {
    if (!code) continue;
    // SQLSTATE: 5 characters, leading digit, alphanumeric subclass (e.g. 42P01, 3D000).
    if (/^[0-9][0-9A-Z]{4}$/.test(code)) return { sqlState: code };
    if (/^P[0-9]{4}$/.test(code)) return { prismaCode: code };
    if (SOCKET_REASONS[code]) return { errno: code };
  }
  return { errno };
}

export function classifyDatabaseFailure(error: unknown): DatabaseFailureClassification | null {
  const { sqlState, prismaCode, errno } = readErrorCode(error);

  if (sqlState) {
    const reason = SQLSTATE_REASONS[sqlState];
    if (!reason) return null;
    return { dependency: dependencyForReason(reason), reason, driverCode: sqlState, sqlState };
  }

  if (prismaCode) {
    const reason = PRISMA_REASONS[prismaCode];
    if (!reason) return null;
    return { dependency: dependencyForReason(reason), reason, driverCode: prismaCode };
  }

  if (errno) {
    const reason = SOCKET_REASONS[errno];
    if (!reason) return null;
    return { dependency: dependencyForReason(reason), reason, driverCode: errno };
  }

  return null;
}

/**
 * True when an error proves the Postgres dependency is unusable.
 * The HTTP error mapper then answers 503 + `dependency` instead of a blind 500.
 */
export function isDatabaseFailure(error: unknown): boolean {
  return classifyDatabaseFailure(error) !== null;
}
