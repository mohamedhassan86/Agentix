import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FoundationStatus } from "@/app/components/foundation/foundation-status";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  const allHeaders: Record<string, string> = { "Content-Type": "application/json", ...headers };
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key: string) => allHeaders[key] ?? null },
    json: async () => body,
  } as unknown as Response;
}

const PROBLEM = {
  type: "about:blank",
  title: "Database schema not ready",
  status: 503,
  code: "SCHEMA_NOT_READY",
  correlationId: "123e4567-e89b-12d3-a456-426614174000",
  dependency: "schema",
  reason: "migration_table_missing",
  detail: "The database has no migration history (missing _prisma_migrations). Apply migrations with the direct (port 5432) connection: npm run db:migrate.",
};

describe("foundation status UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("explains an unavailable dependency with code, reason and remediation - never 'unknown'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(503, PROBLEM, { "X-Correlation-Id": PROBLEM.correlationId })));

    render(<FoundationStatus initialVersion="0.1.0" />);

    expect(await screen.findByText("Database schema not ready")).toBeInTheDocument();
    expect(screen.getByText(/Dependency: schema/)).toBeInTheDocument();
    expect(screen.getByText(/Reason: migration_table_missing/)).toBeInTheDocument();
    expect(screen.getByText(/Code: SCHEMA_NOT_READY/)).toBeInTheDocument();
    expect(screen.getByText(/HTTP 503/)).toBeInTheDocument();
    expect(screen.getAllByText(/npm run db:migrate/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/unknown/i)).toBeNull();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retries the readiness probe when the user clicks Retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, PROBLEM, { "X-Correlation-Id": PROBLEM.correlationId }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "ready", service: "agentix-web", version: "0.1.0", time: new Date().toISOString() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<FoundationStatus initialVersion="0.1.0" />);
    await screen.findByText("Database schema not ready");

    fireEvent.click(screen.getByRole("button", { name: /retry health check/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Foundation ready/i)).toBeInTheDocument();
  });

  it("reports a non-JSON host response instead of a generic failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(500, null, { "Content-Type": "text/html" })
      )
    );

    render(<FoundationStatus initialVersion="0.1.0" />);

    expect(await screen.findByText(/Host did not return a readiness report/i)).toBeInTheDocument();
    expect(screen.getAllByText(/HTTP 500/).length).toBeGreaterThan(0);
  });
});
