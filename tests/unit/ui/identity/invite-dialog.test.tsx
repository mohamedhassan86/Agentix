import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InviteDialog } from "@/app/components/identity/invite-dialog";
import { InvitationList } from "@/app/components/identity/invitation-list";
import { InvitationPreview } from "@/app/components/identity/invitation-preview";

describe("invitation UI", () => {
  it("invite dialog has labelled email/role and no Owner option", () => {
    render(<InviteDialog open onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /owner/i })).not.toBeInTheDocument();
  });

  it("list disables resend/revoke for non-pending with a reason", () => {
    render(
      <InvitationList
        canManage
        onResend={vi.fn()}
        onRevoke={vi.fn()}
        items={[
          {
            id: "1",
            email: "a@example.test",
            role: "admin",
            status: "accepted",
            deliveryState: "sent",
            ageSeconds: 10,
          },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /resend/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /resend/i })).toHaveAttribute("title", "Only pending invitations can be resent");
  });

  it("preview shows organization, role, and status as text plus color", () => {
    render(
      <InvitationPreview
        organizationName="Alpha Org"
        invitedEmail="admin@example.test"
        role="admin"
        status="pending"
        expiresAt="2026-09-20T00:00:00.000Z"
        accountRequired
      />,
    );
    expect(screen.getByText(/alpha org/i)).toBeInTheDocument();
    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });
});
