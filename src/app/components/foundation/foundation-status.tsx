"use client";

import { useEffect, useState, useCallback } from "react";

type StatusState = "loading" | "ready" | "error" | "retrying";

interface HealthData {
  status: "alive" | "ready";
  service: string;
  version: string;
  time: string;
}

/** RFC 9457 Problem Details as returned by /health/ready when the host is not ready. */
interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  correlationId?: string;
  detail?: string;
  dependency?: "database" | "schema";
  reason?: string;
}

interface FoundationStatusProps {
  initialVersion?: string;
}

/** Operator guidance keyed by the machine-readable reason from the problem response. */
const REASON_HINTS: Record<string, string> = {
  database_url_missing:
    "Add DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL) to the host environment variables, then redeploy.",
  connection_refused:
    "The database refused the connection. On Supabase use the transaction pooler URL (port 6543) for DATABASE_URL.",
  connection_timeout: "The database did not answer within 2s. Check network access from the host to Postgres.",
  connection_failed:
    "The connection failed. Verify the connection string, and that TLS is on: hosted Postgres needs ?sslmode=require in DATABASE_URL.",
  tls_handshake_failed:
    "TLS handshake failed. Add ?sslmode=require to DATABASE_URL (or set PG_SSL_MODE=require) - hosted Postgres rejects plaintext connections.",
  tls_verification_failed:
    "TLS is on but the certificate could not be verified. Set PG_SSL_CA to the provider CA, or PG_SSL_MODE=require to encrypt without chain verification.",
  authentication_failed: "Postgres rejected the credentials. Re-copy the connection string and password.",
  database_missing: "The database named in the connection string does not exist on this server.",
  too_many_connections: "The provider's connection pool is exhausted. Use the pooler URL for runtime traffic.",
  server_unavailable: "The database is restarting or under maintenance. Retry in a moment.",
  migration_table_missing: "No migration history found. Run `npm run db:migrate` with the direct (port 5432) connection.",
  no_migrations_applied: "The database is reachable but has no migrations. Run `npm run db:migrate`.",
  foundation_migration_not_applied: "Migration 001_solution_foundation is missing. Run `npm run db:migrate`.",
  migration_history_drift:
    "Tables exist but the migration is not recorded. Run `npx prisma migrate resolve --applied 20250912000000_001_solution_foundation`.",
};

function titleForProblem(problem: ProblemDetails | null, fallback: string): string {
  if (problem?.title) return problem.title;
  if (problem?.dependency === "schema") return "Database schema not ready";
  if (problem?.dependency === "database") return "Database dependency unavailable";
  return fallback;
}

export function FoundationStatus({ initialVersion = "0.1.0" }: FoundationStatusProps) {
  const [state, setState] = useState<StatusState>("loading");
  const [health, setHealth] = useState<HealthData | null>(null);
  const [problem, setProblem] = useState<ProblemDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setState((prev) => (prev === "loading" ? "loading" : "retrying"));
    setError(null);
    try {
      const res = await fetch("/health/ready", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const corr = res.headers.get("X-Correlation-Id");
      if (corr) setCorrelationId(corr);

      if (!res.ok) {
        const contentType = res.headers.get("Content-Type") ?? "";
        const body = contentType.includes("json") ? await res.json().catch(() => null) : null;

        if (!body) {
          // The host returned a page instead of Problem Details (proxy/edge error, crash page).
          setProblem({ status: res.status, title: "Host did not return a readiness report" });
          setError(
            `The host answered HTTP ${res.status} with ${contentType || "an unknown content type"}. Check the deployment logs with correlation id ${corr ?? "unknown"}.`
          );
          setState("error");
          return;
        }

        const details = body as ProblemDetails;
        setProblem(details);
        if (details.correlationId) setCorrelationId(details.correlationId);
        setError(details.detail ?? `Request failed with HTTP ${res.status}`);
        setState("error");
        return;
      }

      const data = (await res.json()) as HealthData;
      setHealth(data);
      setProblem(null);
      setState("ready");
    } catch (e) {
      setProblem(null);
      setError(
        e instanceof Error
          ? `Could not reach /health/ready: ${e.message}`
          : "Could not reach /health/ready"
      );
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const retrying = state === "retrying";
  const errorTitle = titleForProblem(problem, "Readiness check failed");
  const reasonHint = problem?.reason ? REASON_HINTS[problem.reason] : undefined;

  return (
    <div className="card" style={{ marginTop: "16px" }}>
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 id="foundation-status-heading" style={{ margin: 0, fontSize: "16px" }}>
          Host Status
        </h2>
        <span
          className="status-chip"
          aria-live="polite"
          aria-atomic="true"
          data-state={state}
          style={{
            borderColor: state === "ready" ? "var(--green)" : state === "error" ? "var(--red)" : "var(--border)",
            color: state === "ready" ? "var(--green)" : state === "error" ? "var(--red)" : "var(--muted)",
          }}
        >
          <span
            className="dot"
            style={{
              background: state === "ready" ? "var(--green)" : state === "error" ? "var(--red)" : "var(--yellow)",
            }}
          />
          {state === "loading" && "Loading – checking dependencies"}
          {state === "ready" && "Ready – all dependencies healthy"}
          {state === "error" && "Error – dependency unavailable"}
          {state === "retrying" && "Retrying – rechecking health"}
        </span>
      </div>

      <div style={{ marginTop: "12px" }} aria-live="polite">
        {state === "loading" && (
          <div className="banner" role="status">
            <span>Checking foundation host and database readiness…</span>
          </div>
        )}

        {state === "ready" && health && (
          <div>
            <div className="banner" style={{ borderColor: "var(--green)", background: "var(--green-soft)" }}>
              <span>
                Foundation ready – service {health.service} v{health.version} at {new Date(health.time).toLocaleString()}
              </span>
            </div>
            <div style={{ marginTop: "12px", display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <span className="status-chip">Status: {health.status}</span>
                <span className="status-chip">Service: {health.service}</span>
                <span className="status-chip">Version: {health.version}</span>
                {correlationId && <span className="status-chip">Correlation: {correlationId.slice(0, 8)}…</span>}
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div>
            <div className="banner" style={{ borderColor: "var(--red)", background: "var(--red-soft)" }} role="alert">
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <strong>{errorTitle}</strong>
                {error && <span>{error}</span>}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                  {problem?.status && <span className="status-chip">HTTP {problem.status}</span>}
                  {problem?.code && <span className="status-chip">Code: {problem.code}</span>}
                  {problem?.dependency && <span className="status-chip">Dependency: {problem.dependency}</span>}
                  {problem?.reason && <span className="status-chip">Reason: {problem.reason}</span>}
                  {correlationId && <span className="status-chip">Correlation: {correlationId.slice(0, 8)}…</span>}
                </div>
              </div>
            </div>

            {reasonHint && (
              <div className="banner" style={{ marginTop: "12px", borderColor: "var(--yellow)", background: "var(--yellow-soft)" }} role="status">
                <span>Fix: {reasonHint}</span>
              </div>
            )}

            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={fetchHealth}
                disabled={retrying}
                aria-label="Retry health check"
              >
                {retrying ? "Retrying…" : "Retry"}
              </button>
              <span style={{ color: "var(--muted)", fontSize: "11px" }}>
                Re-runs the bounded database and schema probe. Safe to press as often as needed.
              </span>
            </div>
          </div>
        )}

        {state === "retrying" && (
          <div className="banner" role="status">
            <span>Retrying health check…</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        <h3 style={{ fontSize: "13px", marginBottom: "8px" }}>Foundation Patterns</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          <div className="card" style={{ background: "var(--surface-2)" }}>
            <strong>Correlation</strong>
            <p style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>
              Every response carries X-Correlation-Id. Valid caller value propagated, otherwise generated.
            </p>
          </div>
          <div className="card" style={{ background: "var(--surface-2)" }}>
            <strong>Errors</strong>
            <p style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>
              RFC 9457 Problem Details with stable code, correlation, safe detail. No secret leakage.
            </p>
          </div>
          <div className="card" style={{ background: "var(--surface-2)" }}>
            <strong>Design Tokens</strong>
            <p style={{ color: "var(--muted)", fontSize: "11px", marginTop: "4px" }}>
              Canonical --bg, --surface, --border, --text, --primary, --radius. No external fonts.
            </p>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "12px", color: "var(--muted-2)", fontSize: "10px" }}>
        Version {initialVersion} – foundation only, no auth/tenant/project/provider.
      </div>
    </div>
  );
}
