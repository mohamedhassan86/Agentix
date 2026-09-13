export default function IdentityLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "32px", maxWidth: "720px", margin: "0 auto" }}>
      <p style={{ color: "var(--muted)", marginBottom: "16px" }}>Agentix</p>
      {children}
    </main>
  );
}
