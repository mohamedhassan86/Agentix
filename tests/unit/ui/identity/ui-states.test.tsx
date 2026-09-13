import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoadingState } from "@/app/components/identity/loading";
import { Empty } from "@/app/components/identity/empty";
import { ErrorState } from "@/app/components/identity/error";
import { PermissionDenied } from "@/app/components/identity/permission-denied";
import { ExpiredRevoked } from "@/app/components/identity/expired-revoked";
import { DeliveryFailed } from "@/app/components/identity/delivery-failed";
import { NoActiveOrg } from "@/app/components/identity/no-active-org";

describe("identity UI states", () => {
  it("loading uses a polite live region", () => {
    render(<LoadingState label="Loading members…" />);
    expect(screen.getByRole("status")).toHaveTextContent(/loading members/i);
  });

  it("empty state exposes a labelled action", () => {
    render(<Empty title="No members" description="Invite teammates." actionLabel="Invite" onAction={vi.fn()} />);
    expect(screen.getByText(/no members/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /invite/i })).toBeInTheDocument();
  });

  it("error is text plus color with retry", () => {
    render(<ErrorState title="Could not load" detail="Network error" onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i);
    expect(document.querySelector(".status-chip")?.textContent).toMatch(/error/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("permission denied is visible, not hidden", () => {
    render(<PermissionDenied detail="Viewer cannot invite" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/permission denied/i);
    expect(screen.getByText(/viewer cannot invite/i)).toBeInTheDocument();
  });

  it("expired and revoked invitations show status as text", () => {
    const { rerender } = render(<ExpiredRevoked status="expired" organizationName="Alpha Org" />);
    expect(screen.getByRole("heading", { name: /invitation expired/i })).toBeInTheDocument();
    expect(document.querySelector(".status-chip")?.textContent).toMatch(/expired/i);
    rerender(<ExpiredRevoked status="revoked" />);
    expect(screen.getByRole("heading", { name: /invitation revoked/i })).toBeInTheDocument();
  });

  it("delivery failed keeps pending and disables resend with a reason", () => {
    render(<DeliveryFailed onResend={vi.fn()} disabledReason="Only Owner or Admin can resend" />);
    expect(screen.getByText(/still pending/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /resend invitation/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /resend invitation/i })).toHaveAttribute(
      "title",
      "Only Owner or Admin can resend",
    );
  });

  it("no-active-org hides tenant data", () => {
    render(<NoActiveOrg onChoose={vi.fn()} />);
    expect(screen.getByText(/no active organization/i)).toBeInTheDocument();
    expect(screen.getByText(/tenant data is hidden/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose organization/i })).toBeInTheDocument();
  });
});
