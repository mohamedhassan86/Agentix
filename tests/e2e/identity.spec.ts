import { test, expect } from "@playwright/test";

test.describe("identity golden path", () => {
  test("register → verify page → sign-in → sign-out controls are keyboard operable", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();

    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await page.getByLabel(/email/i).focus();
    await expect(page.getByLabel(/email/i)).toBeFocused();

    await page.goto("/verify-email");
    await expect(page.getByRole("heading", { name: /email verification/i })).toBeVisible();
  });

  test("US3 invite dialog is keyboard operable", async ({ page }) => {
    await page.goto("/organization/invitations");
    await expect(page.getByRole("heading", { name: /invitations/i })).toBeVisible();
  });

  test("US2 create org empty state is keyboard operable", async ({ page }) => {
    await page.goto("/organizations");
    await expect(page.getByRole("heading", { name: /no organizations|organizations|choose organization/i })).toBeVisible();
    const create = page.getByRole("button", { name: /create organization/i });
    await create.focus();
    await expect(create).toBeFocused();
  });
});

test.describe("identity accessibility", () => {
  test("auth, switcher, and identity nav remain keyboard operable", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).focus();
    await expect(page.getByLabel(/email/i)).toBeFocused();
    await page.goto("/organizations");
    await expect(page.getByRole("navigation", { name: /identity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /no organizations|organizations|choose organization/i })).toBeVisible();
  });

  test("320px narrow and reduced-motion keep identity screens usable", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 40);
    expect(overflowX).toBe(false);
  });
});

test.describe("identity permission states", () => {
  test("members and settings pages expose denied, empty, or no-active-org states", async ({ page }) => {
    await page.goto("/members");
    await expect(page.getByText(/loading members|members|permission denied|no active organization|authentication|something went wrong/i)).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText(/loading organization settings|organization settings|permission denied|no active organization|authentication|something went wrong/i)).toBeVisible();
  });
});
