export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "32px", maxWidth: "480px", margin: "0 auto" }}>
      <a className="skip-link" href="#auth-content">
        Skip to content
      </a>
      <p style={{ color: "var(--muted)", marginBottom: "16px" }}>Agentix</p>
      <div id="auth-content">{children}</div>
    </main>
  );
}
