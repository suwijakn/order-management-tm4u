import { test, expect } from "@playwright/test";
import { loginAsManager } from "./helpers/auth.js";

test.describe("Navigation Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
  });

  test("should navigate between tabs without content freezing", async ({
    page,
  }) => {
    // Start at Dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Navigate to Deleted Orders
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL("/deleted-orders");
    await expect(page.locator("text=Deleted Orders")).toBeVisible();

    // Navigate back to Dashboard - content should update
    await page.click('a[href="/dashboard"]');
    await page.waitForURL("/dashboard");
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Verify spreadsheet grid is visible (not frozen)
    await expect(
      page
        .locator('[data-testid="spreadsheet-grid"]')
        .or(page.locator(".spreadsheet-grid")),
    ).toBeVisible({ timeout: 5000 });

    // Navigate to Pending Approvals
    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL("/pending-approvals");
    await expect(page.locator("text=Pending Approvals")).toBeVisible();

    // Navigate back to Deleted Orders
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL("/deleted-orders");
    await expect(page.locator("text=Deleted Orders")).toBeVisible();

    // Navigate to Dashboard again - final check
    await page.click('a[href="/dashboard"]');
    await page.waitForURL("/dashboard");
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("should maintain layout during navigation", async ({ page }) => {
    // Check header is present
    const header = page.locator("header").or(page.locator('[role="banner"]'));
    await expect(header).toBeVisible();

    // Navigate to different tabs
    await page.click('a[href="/deleted-orders"]');
    await expect(header).toBeVisible();

    await page.click('a[href="/pending-approvals"]');
    await expect(header).toBeVisible();

    await page.click('a[href="/dashboard"]');
    await expect(header).toBeVisible();
  });

  test("should not throw columnsStore errors on Deleted Orders", async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL("/deleted-orders");
    await page.waitForTimeout(2000);

    // Check for the specific error
    const hasColumnStoreError = errors.some((err) =>
      err.includes("columnsStore.fetchDefinitions is not a function"),
    );
    expect(hasColumnStoreError).toBe(false);
  });
});
