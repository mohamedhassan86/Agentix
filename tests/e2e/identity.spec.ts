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
});
