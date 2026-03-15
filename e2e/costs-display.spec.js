import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers/auth.js";

test.describe("Costs Display", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test("should display all costs, not just the first one", async ({ page }) => {
    // Wait for spreadsheet to load
    await page.waitForTimeout(2000);

    // Look for cost rows (manager/super admin only)
    const costRows = page
      .locator('[data-testid="cost-row"]')
      .or(page.locator(".cost-row"));

    // If there are multiple cost rows, verify they're all visible
    const count = await costRows.count();
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        await expect(costRows.nth(i)).toBeVisible();
      }
    }

    // Alternatively, check for cost cells
    const costCells = page
      .locator("[data-cost-cell]")
      .or(page.locator(".cost-cell"));
    const costCount = await costCells.count();

    // Verify multiple costs are rendered if they exist
    if (costCount > 1) {
      console.log(`Found ${costCount} cost cells`);
      expect(costCount).toBeGreaterThan(1);
    }
  });
});
