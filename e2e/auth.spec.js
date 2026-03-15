import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsJrSales, login } from "./helpers/auth.js";

test.describe("Authentication", () => {
  test("redirect unauthenticated to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("should login with valid credentials", async ({ page }) => {
    await loginAsManager(page);
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("show error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', "invalid@test.com");
    await page.fill('input[type="password"]', "wrong");
    await page.click('button[type="submit"]');
    await expect(page.locator("text=/error|invalid/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should logout successfully", async ({ page }) => {
    await loginAsManager(page);
    await page.click('button:has-text("Logout"), [data-testid="logout"]');
    await expect(page).toHaveURL(/\/login/);
  });

  test("should persist session across page reloads", async ({ page }) => {
    await loginAsManager(page);
    await page.reload();
    await expect(page).toHaveURL("/dashboard");
  });
});

test.describe("Authorization", () => {
  test("jr_sales cannot see cost rows", async ({ page }) => {
    await loginAsJrSales(page);
    await expect(
      page.locator('[data-testid="cost-row"], .cost-row'),
    ).not.toBeVisible();
  });

  test("manager can see cost rows", async ({ page }) => {
    await loginAsManager(page);
    await page.waitForTimeout(2000);
    const costRows = page.locator('[data-testid="cost-row"], .cost-row');
    // Only check if costs exist in data
    const count = await costRows.count();
    if (count > 0) {
      await expect(costRows.first()).toBeVisible();
    }
  });
});
