import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

describe("canonical design tokens", () => {
  it("globals.css has exact mock token names/values", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");

    const requiredTokens = [
      "--bg",
      "--surface",
      "--surface-2",
      "--surface-3",
      "--border",
      "--border-strong",
      "--text",
      "--muted",
      "--muted-2",
      "--primary",
      "--primary-bright",
      "--primary-soft",
      "--cyan",
      "--cyan-soft",
      "--green",
      "--green-soft",
      "--yellow",
      "--yellow-soft",
      "--red",
      "--red-soft",
      "--radius",
      "--sidebar-width",
    ];

    for (const token of requiredTokens) {
      expect(css, `should have token ${token}`).toContain(token);
    }

    // Check exact values from mock
    expect(css).toContain("--bg:#080b11");
    expect(css).toContain("--primary:#8274f8");
    expect(css).toContain("--radius:14px");
  });

  it("component colors are variable-based, not literal hex", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    // Card, btn, status-chip, banner should use var(--)
    expect(css).toMatch(/\.card.*var\(--/s);
    expect(css).toMatch(/\.btn.*var\(--/s);
    expect(css).toMatch(/\.status-chip.*var\(--/s);
    expect(css).toMatch(/\.banner.*var\(--/s);
  });

  it("has visible focus treatment", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/outline.*var\(--primary-bright\)/);
  });

  it("has complete prefers-reduced-motion overrides", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    expect(css).toMatch(/@media.*prefers-reduced-motion/);
    expect(css).toMatch(/animation:none/);
    expect(css).toMatch(/transition:none/);
  });

  it("media queries use valid units and the zoom guard is unconditional", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    // Percentages are invalid in media queries - browsers discard such blocks entirely
    for (const m of css.match(/@media[^{]+/g) ?? []) {
      expect(m, `invalid media query: ${m}`).not.toMatch(/(min|max)-width:\s*\d+%/);
    }
    // Zoom cannot be detected via media query, so the FR-033 no-horizontal-loss
    // guard must live outside any media query to take effect at 200% zoom
    expect(css).toMatch(/body\{min-width:320px;overflow-x:auto\}/);
    expect(css).toMatch(/\.card\{max-width:100%;word-wrap:break-word\}/);
  });

  it("no external font request at runtime", () => {
    const css = readFileSync("src/app/globals.css", "utf-8");
    const layout = readFileSync("src/app/layout.tsx", "utf-8");

    // Should not have @import url(https://fonts.googleapis.com)
    expect(css).not.toMatch(/@import.*fonts\.googleapis/);
    expect(layout).not.toMatch(/fonts\.googleapis/);
    expect(css).toMatch(/font-family:Inter/);
  });
});
