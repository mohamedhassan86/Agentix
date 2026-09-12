import { FoundationStatus } from "./components/foundation/foundation-status";

export default function FoundationPage() {
  const version = process.env.npm_package_version ?? "0.1.0";

  return (
    <main style={{ padding: "32px", maxWidth: "900px", margin: "0 auto" }}>
      <header>
        <h1 style={{ fontSize: "28px", letterSpacing: "-0.02em" }}>Agentix Foundation</h1>
        <p style={{ color: "var(--muted)", marginTop: "8px", maxWidth: "600px" }}>
          Solution foundation for tenancy and identity: compiling host, enforced boundaries, stable API, durable work,
          observability, and canonical design. No business entities yet.
        </p>
      </header>

      <FoundationStatus initialVersion={version} />

      <section style={{ marginTop: "24px" }}>
        <h2 style={{ fontSize: "14px" }}>Quickstart</h2>
        <ul style={{ color: "var(--muted)", fontSize: "12px", marginTop: "8px", lineHeight: "1.7" }}>
          <li>Install: npm ci</li>
          <li>Database: docker compose up -d (PostgreSQL 16)</li>
          <li>Migrate: npm run db:migrate</li>
          <li>App: npm run dev (http://localhost:3000)</li>
          <li>Worker: npm run worker:dev</li>
          <li>Health: GET /health/live (no deps) and /health/ready (bounded 2s probe)</li>
          <li>Ping: GET /api/v1/ping (versioned, correlation, no-store)</li>
        </ul>
      </section>
    </main>
  );
}
