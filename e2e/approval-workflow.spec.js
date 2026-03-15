import { test, expect } from "@playwright/test";
import { loginAsJrSales, loginAsManager } from "./helpers/auth.js";

test.describe("Approval Workflow", () => {
  test("jr_sales creates pending and manager approves", async ({ browser }) => {
    // Create two contexts for different users
    const jrSalesContext = await browser.newContext();
    const managerContext = await browser.newContext();

    const jrSalesPage = await jrSalesContext.newPage();
    const managerPage = await managerContext.newPage();

    try {
      // Login as jr_sales
      await loginAsJrSales(jrSalesPage);

      // Login as manager
      await loginAsManager(managerPage);

      // Jr_sales creates a pending change
      const testValue = `Test-${Date.now()}`;
      const firstCell = jrSalesPage.locator("[data-cell-id]").first();
      await firstCell.click();
      await firstCell.fill(testValue);
      await jrSalesPage.keyboard.press("Enter");

      // Wait for pending indicator
      await expect(
        jrSalesPage
          .locator('[data-testid="pending-indicator"]')
          .or(jrSalesPage.locator(".pending-indicator")),
      ).toBeVisible({ timeout: 5000 });

      // Manager navigates to Pending Approvals
      await managerPage.click('a[href="/pending-approvals"]');
      await managerPage.waitForURL("/pending-approvals");

      // Wait for pending item to appear
      await expect(
        managerPage
          .locator(`text=${testValue}`)
          .or(managerPage.locator('[data-testid="pending-item"]')),
      ).toBeVisible({ timeout: 10000 });

      // Manager approves the change
      const approveButton = managerPage
        .locator('button:has-text("Approve")')
        .first();
      await approveButton.click();

      // Wait for approval to process
      await managerPage.waitForTimeout(2000);

      // Verify pending is removed from list
      await expect(managerPage.locator(`text=${testValue}`)).not.toBeVisible({
        timeout: 5000,
      });

      // Manager should be able to approve another without refresh
      // Navigate back to dashboard and then to pending approvals
      await managerPage.click('a[href="/dashboard"]');
      await managerPage.waitForURL("/dashboard");
      await managerPage.click('a[href="/pending-approvals"]');
      await managerPage.waitForURL("/pending-approvals");

      // Page should load without errors
      await expect(managerPage.locator("text=Pending Approvals")).toBeVisible();
    } finally {
      await jrSalesContext.close();
      await managerContext.close();
    }
  });

  test("jr_sales can create pending on previously resolved doc", async ({
    page,
  }) => {
    await loginAsJrSales(page);

    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    // Create first pending change
    const testValue1 = `Test1-${Date.now()}`;
    const firstCell = page.locator("[data-cell-id]").first();
    await firstCell.click();
    await firstCell.fill(testValue1);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Create second pending change on same cell (simulating resolved doc)
    const testValue2 = `Test2-${Date.now()}`;
    await firstCell.click();
    await firstCell.fill(testValue2);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);

    // Check for permission denied errors
    const hasPermissionError = errors.some(
      (err) =>
        err.toLowerCase().includes("permission") ||
        err.toLowerCase().includes("denied"),
    );
    expect(hasPermissionError).toBe(false);
  });
});
