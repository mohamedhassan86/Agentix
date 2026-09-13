import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemberActions } from "@/app/components/identity/member-actions";
import { TransferOwnershipDialog } from "@/app/components/identity/transfer-ownership-dialog";
import { RoleMatrix } from "@/app/components/identity/role-matrix";

describe("role UI", () => {
  it("disables Owner mutations with a reason", () => {
    render(
      <MemberActions
        memberId="1"
        role="owner"
        actorRole="admin"
        onChangeRole={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /remove/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /remove/i })).toHaveAttribute("title", "Owner must be transferred, not changed");
  });

  it("transfer dialog requires TRANSFER confirmation and labelled fields", () => {
    render(
      <TransferOwnershipDialog
        open
        targets={[{ id: "m1", displayName: "Ada", role: "admin" }]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/new owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type transfer/i)).toBeInTheDocument();
  });

  it("role matrix is text not color-only", () => {
    render(<RoleMatrix />);
    expect(screen.getByText(/invite teammates/i)).toBeInTheDocument();
    expect(screen.getAllByText("N").length).toBeGreaterThan(0);
  });
});
