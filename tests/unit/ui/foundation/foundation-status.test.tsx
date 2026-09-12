import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FoundationStatus } from "@/app/components/foundation/foundation-status";

describe("foundation status UI", () => {
  it("renders loading state initially", () => {
    render(<FoundationStatus initialVersion="0.1.0" />);
    expect(screen.getByText(/Host Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("has text-plus-color status (not color alone)", () => {
    render(<FoundationStatus initialVersion="0.1.0" />);
    // Status chip should have both text and visual indicator
    const chip = document.querySelector(".status-chip");
    expect(chip).not.toBeNull();
    // Text content should be meaningful
    expect(chip?.textContent).toMatch(/Loading|Ready|Error|Retrying/i);
  });

  it("has accessible heading and live region", () => {
    render(<FoundationStatus initialVersion="0.1.0" />);
    const heading = screen.getByRole("heading", { name: /Host Status/i });
    expect(heading).toBeInTheDocument();

    // aria-live polite should exist
    const liveRegions = document.querySelectorAll("[aria-live='polite']");
    expect(liveRegions.length).toBeGreaterThan(0);
  });

  it("shows foundation patterns and version", () => {
    render(<FoundationStatus initialVersion="0.1.0" />);
    expect(screen.getByText(/Foundation Patterns/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Correlation/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Errors/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Design Tokens/i)).toBeInTheDocument();
  });
});
