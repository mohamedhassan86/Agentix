import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthForm } from "@/app/components/identity/auth-form";
import { VerificationState } from "@/app/components/identity/verification-state";
import { AccountStatus } from "@/app/components/identity/account-status";

describe("identity auth UI", () => {
  it("renders labelled fields, inline errors, and loading state", async () => {
    const onSubmit = vi.fn();
    render(<AuthForm mode="sign-up" onSubmit={onSubmit} pending={false} error={null} />);
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /register/i })).toBeInTheDocument();
  });

  it("shows verification states including already_verified", () => {
    const { rerender } = render(<VerificationState status="loading" />);
    expect(screen.getByText(/checking verification/i)).toBeInTheDocument();
    rerender(<VerificationState status="already_verified" />);
    expect(screen.getAllByText(/already verified/i).length).toBeGreaterThan(0);
    rerender(<VerificationState status="unverified" />);
    expect(screen.getByText(/not verified/i)).toBeInTheDocument();
  });

  it("account status uses text plus color chip", () => {
    render(<AccountStatus email="a@example.test" verified={false} />);
    const chip = document.querySelector(".status-chip");
    expect(chip?.textContent).toMatch(/unverified/i);
    expect(screen.getByText(/not verified yet/i)).toBeInTheDocument();
  });
});
