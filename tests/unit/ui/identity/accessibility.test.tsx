import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { AuthForm } from "@/app/components/identity/auth-form";
import { InviteDialog } from "@/app/components/identity/invite-dialog";
import { CreateOrganizationDialog } from "@/app/components/identity/create-organization-dialog";
import { TransferOwnershipDialog } from "@/app/components/identity/transfer-ownership-dialog";
import { DeleteOrganizationDialog } from "@/app/components/identity/delete-organization-dialog";
import { OrganizationSwitcher } from "@/app/components/identity/organization-switcher";

function collectTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsx(full));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("identity accessibility", () => {
  it("auth form fields have labels and announce errors", () => {
    render(<AuthForm mode="sign-in" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    expect(screen.getByRole("alert")).toHaveAttribute("aria-live", "polite");
  });

  it("invite, create, transfer, and delete dialogs close on Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(<InviteDialog open onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document.querySelector(".dialog-backdrop") as HTMLElement, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    rerender(<CreateOrganizationDialog open onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document.querySelector(".dialog-backdrop") as HTMLElement, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    rerender(
      <TransferOwnershipDialog
        open
        targets={[{ id: "m1", displayName: "Ada", role: "admin" }]}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );
    fireEvent.keyDown(document.querySelector(".dialog-backdrop") as HTMLElement, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();

    onClose.mockClear();
    rerender(<DeleteOrganizationDialog open slug="alpha-org" onClose={onClose} onSubmit={vi.fn()} />);
    fireEvent.keyDown(document.querySelector(".dialog-backdrop") as HTMLElement, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("organization switcher is keyboard operable with choose-org live region", () => {
    render(
      <OrganizationSwitcher
        organizations={[{ id: "1", name: "Alpha", slug: "alpha-org", currentRole: "owner" }]}
        activeOrganizationId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("button", { name: /alpha/i })).toBeEnabled();
  });

  it("identity components use canonical tokens, not literal hex", () => {
    const files = collectTsx("src/app/components/identity");
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      expect(content, file).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    }
  });

  it("globals.css keeps 2px focus-visible on --primary-bright and reduced-motion", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    expect(css).toMatch(/:focus-visible\{outline:2px solid var\(--primary-bright\)/);
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/min-width:320px/);
  });
});
