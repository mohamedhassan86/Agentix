"use client";

import { useEffect, useState, useCallback } from "react";

type StatusState = "loading" | "ready" | "error" | "retrying";

interface HealthData {
  status: "alive" | "ready";
  service: string;
  version: string;
  time: string;
}

interface FoundationStatusProps {
  initialVersion?: string;
}

export function FoundationStatus({ initialVersion = "0.1.0" }: FoundationStatusProps) {
  const [state, setState] = useState<StatusState>("loading");
  const [health, setHealth] = useState<HealthData | null>(null);
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
        const body = await res.json().catch(() => ({}));
        const dep = body.dependency ?? "unknown";
        throw new Error(`Dependency ${dep} unavailable (${res.status})`);
      }

      const data = (await res.json()) as HealthData;
      setHealth(data);
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch health");
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

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
              <span>Database or schema dependency unavailable. {error}</span>
            </div>
            <div style={{ marginTop: "12px" }}>
              <button className="btn btn-primary" onClick={fetchHealth} aria-label="Retry health check">
                Retry
              </button>
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
