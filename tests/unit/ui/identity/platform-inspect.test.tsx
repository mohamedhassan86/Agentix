import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlatformInspectView } from "@/app/components/identity/platform-inspect-view";
import { ChooseOrganization } from "@/app/components/identity/choose-organization";

describe("switcher and platform UI", () => {
  it("choose-organization asks the user to pick a membership", () => {
    render(
      <ChooseOrganization
        organizations={[{ id: "1", name: "Alpha", slug: "alpha-org", currentRole: "owner" }]}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByText(/choose organization/i)).toBeInTheDocument();
  });

  it("platform inspect is read-only with text status", () => {
    render(<PlatformInspectView organizationName="Alpha" slug="alpha-org" memberCount={1} invitationCount={0} />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.getByText(/not available to platform administrators/i)).toBeInTheDocument();
  });
});
