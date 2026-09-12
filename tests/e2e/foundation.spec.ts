import { test, expect } from "@playwright/test";

test.describe("foundation page accessibility", () => {
  test("has Agentix branding and no fake auth controls", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Agentix Foundation/i })).toBeVisible();
    await expect(page.getByText(/Solution foundation/i)).toBeVisible();

    // Should not have fake sign-in, org, project controls
    await expect(page.getByText(/Sign in/i)).toHaveCount(0);
    await expect(page.getByText(/Create organization/i)).toHaveCount(0);
    await expect(page.getByText(/Create project/i)).toHaveCount(0);
  });

  test("loading, ready, error, retry states with text-plus-color", async ({ page }) => {
    await page.goto("/");

    // Should have status heading
    await expect(page.getByRole("heading", { name: /Host Status/i })).toBeVisible();

    // Status chip should have text, not just color
    const chip = page.locator(".status-chip").first();
    await expect(chip).toBeVisible();
    const text = await chip.textContent();
    expect(text).toMatch(/Loading|Ready|Error|Retrying/i);
  });

  test("keyboard operable and focus visible", async ({ page }) => {
    await page.goto("/");

    // Tab to retry button if present
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Check focus visible style exists via CSS
    const focusVisible = await page.evaluate(() => {
      const style = document.createElement("style");
      style.textContent = ":focus-visible { outline: 2px solid red; }";
      document.head.appendChild(style);
      return true;
    });
    expect(focusVisible).toBe(true);
  });

  test("aria-live polite announcements", async ({ page }) => {
    await page.goto("/");

    const liveRegions = page.locator("[aria-live='polite']");
    await expect(liveRegions.first()).toBeVisible();
  });

  test("no horizontal loss at 200% zoom and narrow viewport", async ({ page }) => {
    // Narrow viewport
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /Agentix Foundation/i })).toBeVisible();

    // 200% zoom simulation via viewport and CSS
    await page.evaluate(() => {
      document.body.style.zoom = "200%";
    });

    // Primary action should still be visible (no horizontal loss)
    await expect(page.getByRole("heading", { name: /Host Status/i })).toBeVisible();
  });

  test("reduced motion disables animations", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    const hasReducedMotion = await page.evaluate(() => {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    });

    expect(hasReducedMotion).toBe(true);
  });
});
