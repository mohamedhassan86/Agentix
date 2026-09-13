export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ padding: "32px", maxWidth: "480px", margin: "0 auto" }}>
      <p style={{ color: "var(--muted)", marginBottom: "16px" }}>Agentix</p>
      {children}
    </main>
  );
}
