import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreateOrganizationDialog } from "@/app/components/identity/create-organization-dialog";
import { OrganizationSwitcher } from "@/app/components/identity/organization-switcher";
import { EmptyState } from "@/app/components/identity/empty-state";
import { OrganizationSettings } from "@/app/components/identity/organization-settings";

describe("organization UI", () => {
  it("create dialog has labelled fields, errors, and close control", () => {
    render(
      <CreateOrganizationDialog
        open
        error="Slug conflict"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^slug$/i)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/slug conflict/i);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  it("empty state and switcher expose create action", () => {
    render(
      <EmptyState
        title="No organizations"
        description="Create your first organization to become Owner, or accept an invitation."
        actionLabel="Create organization"
        onAction={vi.fn()}
      />,
    );
    expect(screen.getByText(/no organizations/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();

    render(
      <OrganizationSwitcher
        organizations={[]}
        activeOrganizationId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: /create organization/i }).length).toBeGreaterThan(0);
  });

  it("settings disable non-owner mutations with a reason", () => {
    render(
      <OrganizationSettings
        name="Alpha"
        slug="alpha-org"
        currentRole="member"
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /delete organization/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save/i })).toHaveAttribute("title", "Owner only");
  });
});
