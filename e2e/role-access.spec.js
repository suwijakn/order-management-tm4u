import { test, expect } from '@playwright/test';

test.describe('Role-Based Access Control', () => {
  test('manager sees all navigation items', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    await expect(page.locator('a[href="/pending-approvals"]')).toBeVisible();
    await expect(page.locator('a[href="/deleted-orders"]')).toBeVisible();
  });

  test('jr_sales has limited navigation', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_JR_SALES_EMAIL || 'jrsales@test.com');
    await page.fill('input[type="password"]', process.env.TEST_JR_SALES_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await expect(page.locator('a[href="/dashboard"]')).toBeVisible();
    
    // jr_sales should not see pending-approvals or deleted-orders
    const pendingLink = page.locator('a[href="/pending-approvals"]');
    const deletedLink = page.locator('a[href="/deleted-orders"]');
    
    const pendingVisible = await pendingLink.isVisible().catch(() => false);
    const deletedVisible = await deletedLink.isVisible().catch(() => false);
    
    expect(pendingVisible).toBe(false);
    expect(deletedVisible).toBe(false);
  });

  test('manager can edit cells directly', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const cell = page.locator('[data-cell-id]').first();
    const testVal = `Mgr-${Date.now()}`;
    await cell.click();
    await page.keyboard.type(testVal);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    // Manager edits should apply directly (no pending)
    await expect(cell).toContainText(testVal);
  });

  test('jr_sales edits create pending requests', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_JR_SALES_EMAIL || 'jrsales@test.com');
    await page.fill('input[type="password"]', process.env.TEST_JR_SALES_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const cell = page.locator('[data-cell-id]').first();
    await cell.click();
    await page.keyboard.type(`Jr-${Date.now()}`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Should see pending indicator
    const pending = page.locator('[data-testid="pending-indicator"], .pending-indicator, .pending');
    const hasPending = await pending.count() > 0;
    expect(hasPending).toBe(true);
  });
});
