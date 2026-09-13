export default function IdentityLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "32px", maxWidth: "720px", margin: "0 auto" }}>
      <a className="skip-link" href="#identity-content">
        Skip to content
      </a>
      <p style={{ color: "var(--muted)", marginBottom: "16px" }}>Agentix</p>
      <nav aria-label="Identity" style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <a href="/organizations">Organizations</a>
        <a href="/members">Members</a>
        <a href="/organization/invitations">Invitations</a>
        <a href="/settings">Settings</a>
      </nav>
      <div id="identity-content">{children}</div>
    </main>
  );
}
