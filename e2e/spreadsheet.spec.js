import { test, expect } from "@playwright/test";
import { loginAsJrSales } from "./helpers/auth.js";

test.describe("Spreadsheet Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsJrSales(page);
  });

  test("click cell to edit", async ({ page }) => {
    const cell = page.locator("[data-cell-id]").first();
    await cell.click();
    await expect(cell.locator('input, [contenteditable="true"]')).toBeVisible();
  });

  test("type and save with Enter", async ({ page }) => {
    const cell = page.locator("[data-cell-id]").first();
    const testValue = `Test-${Date.now()}`;
    await cell.click();
    await page.keyboard.type(testValue);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await expect(cell).toContainText(testValue);
  });

  test("navigate cells with arrow keys", async ({ page }) => {
    const firstCell = page.locator("[data-cell-id]").first();
    await firstCell.click();

    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);

    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);

    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(200);

    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
  });

  test("display pending indicator after jr_sales edit", async ({ page }) => {
    await page.click('button:has-text("Logout"), [data-testid="logout"]');
    await page.waitForURL("/login");

    await page.fill(
      'input[type="email"]',
      process.env.TEST_JR_SALES_EMAIL || "jrsales@test.com",
    );
    await page.fill(
      'input[type="password"]',
      process.env.TEST_JR_SALES_PASSWORD || "testpassword",
    );
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard", { timeout: 10000 });

    const cell = page.locator("[data-cell-id]").first();
    await cell.click();
    await page.keyboard.type(`Pending-${Date.now()}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    const pending = page.locator(
      '[data-testid="pending-indicator"], .pending-indicator, text=/pending/i',
    );
    const count = await pending.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});
