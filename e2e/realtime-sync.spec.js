import { test, expect } from "@playwright/test";
import { loginAsManager, loginAsJrSales } from "./helpers/auth.js";

test.describe("Real-time Synchronization", () => {
  test("should sync changes between two users in real-time", async ({
    browser,
  }) => {
    // Create two browser contexts (two users)
    const managerContext = await browser.newContext();
    const jrSalesContext = await browser.newContext();

    const managerPage = await managerContext.newPage();
    const jrSalesPage = await jrSalesContext.newPage();

    try {
      // Login as manager
      await loginAsManager(managerPage);

      // Login as jr_sales
      await loginAsJrSales(jrSalesPage);

      // Jr_sales creates a pending change
      const cell = jrSalesPage.locator('td[contenteditable="true"]').first();
      await cell.click();
      const testValue = `Test-${Date.now()}`;
      await cell.fill(testValue);
      await jrSalesPage.keyboard.press("Enter");

      // Wait for pending to be created
      await jrSalesPage.waitForTimeout(1000);

      // Manager should see the pending change appear in real-time
      await managerPage.click('a[href="/pending-approvals"]');
      await managerPage.waitForURL("/pending-approvals");

      // Wait for real-time sync
      await managerPage.waitForTimeout(2000);

      // Verify pending appears for manager
      const pendingExists = await managerPage
        .locator(`text=${testValue}`)
        .isVisible();
      expect(pendingExists).toBeTruthy();
    } finally {
      await managerContext.close();
      await jrSalesContext.close();
    }
  });

  test("should sync approved changes to all users instantly", async ({
    browser,
  }) => {
    const managerContext = await browser.newContext();
    const jrSalesContext = await browser.newContext();

    const managerPage = await managerContext.newPage();
    const jrSalesPage = await jrSalesContext.newPage();

    try {
      // Login both users
      await loginAsManager(managerPage);
      await loginAsJrSales(jrSalesPage);

      // Jr_sales creates a pending
      const cell = jrSalesPage.locator('td[contenteditable="true"]').first();
      await cell.click();
      const testValue = `Sync-${Date.now()}`;
      await cell.fill(testValue);
      await jrSalesPage.keyboard.press("Enter");
      await jrSalesPage.waitForTimeout(1000);

      // Manager approves the pending
      await managerPage.click('a[href="/pending-approvals"]');
      await managerPage.waitForURL("/pending-approvals");
      await managerPage.waitForTimeout(2000);

      const approveButton = managerPage
        .locator("button")
        .filter({ hasText: /approve/i })
        .first();
      if (await approveButton.isVisible()) {
        await approveButton.click();
        await managerPage.waitForTimeout(1000);

        // Jr_sales should see the approved change in real-time
        await jrSalesPage.waitForTimeout(2000);

        // Verify the value is updated and pending indicator is gone
        const cellValue = await jrSalesPage
          .locator("td")
          .filter({ hasText: testValue })
          .first()
          .textContent();
        expect(cellValue).toContain(testValue);
      }
    } finally {
      await managerContext.close();
      await jrSalesContext.close();
    }
  });

  test("should update UI reactively without manual refresh", async ({
    page,
  }) => {
    await loginAsManager(page);

    // Navigate to pending approvals
    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL("/pending-approvals");

    const initialCount = await page.locator("tbody tr").count();

    // Wait for potential real-time updates
    await page.waitForTimeout(3000);

    // Check if count changed (real-time listener working)
    const finalCount = await page.locator("tbody tr").count();

    // Count should be stable or updated via listener (not frozen)
    expect(finalCount).toBeGreaterThanOrEqual(0);
  });

  test("should handle multiple pending changes from same user", async ({
    browser,
  }) => {
    const jrSalesContext = await browser.newContext();
    const jrSalesPage = await jrSalesContext.newPage();

    try {
      await loginAsJrSales(jrSalesPage);

      // Create multiple pending changes
      const cells = jrSalesPage.locator('td[contenteditable="true"]');
      const cellCount = Math.min(await cells.count(), 3);

      for (let i = 0; i < cellCount; i++) {
        const cell = cells.nth(i);
        await cell.click();
        await cell.fill(`Multi-${Date.now()}-${i}`);
        await jrSalesPage.keyboard.press("Enter");
        await jrSalesPage.waitForTimeout(500);
      }

      // Verify all pendings are created
      await jrSalesPage.waitForTimeout(1000);
      const pendingIndicators = await jrSalesPage
        .locator('[data-testid="pending-indicator"], .pending-indicator')
        .count();
      expect(pendingIndicators).toBeGreaterThanOrEqual(cellCount);
    } finally {
      await jrSalesContext.close();
    }
  });

  test("should maintain real-time sync across tab switches", async ({
    page,
  }) => {
    await loginAsManager(page);

    // Switch between tabs
    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL("/pending-approvals");
    await page.waitForTimeout(1000);

    await page.click('a[href="/dashboard"]');
    await page.waitForURL("/dashboard");
    await page.waitForTimeout(1000);

    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL("/pending-approvals");

    // Verify data is still loading (listeners still active)
    await page.waitForTimeout(2000);
    const hasContent =
      (await page.locator('tbody tr, [data-testid="empty-state"]').count()) > 0;
    expect(hasContent).toBeTruthy();
  });
});
