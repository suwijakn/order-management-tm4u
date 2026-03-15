import { test, expect } from '@playwright/test';

test.describe('Deleted Orders', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('loads deleted orders view', async ({ page }) => {
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    await expect(page.locator('text=Deleted Orders')).toBeVisible();
  });

  test('no JS errors on deleted orders page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    await page.waitForTimeout(2000);

    const criticalErrors = errors.filter(e => 
      e.includes('fetchDefinitions') || 
      e.includes('is not a function') ||
      e.includes('Cannot read')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('can navigate away and back', async ({ page }) => {
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    
    await page.click('a[href="/dashboard"]');
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Dashboard')).toBeVisible();
    
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    await expect(page.locator('text=Deleted Orders')).toBeVisible();
  });

  test('jr_sales cannot access deleted orders', async ({ page }) => {
    await page.click('button:has-text("Logout"), [data-testid="logout"]');
    await page.waitForURL('/login');

    await page.fill('input[type="email"]', process.env.TEST_JR_SALES_EMAIL || 'jrsales@test.com');
    await page.fill('input[type="password"]', process.env.TEST_JR_SALES_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await page.goto('/deleted-orders');
    await page.waitForTimeout(1000);
    
    // Should redirect or show access denied
    const url = page.url();
    const hasAccess = url.includes('/deleted-orders');
    const accessDenied = await page.locator('text=/access denied|not authorized|permission/i').isVisible();
    
    expect(hasAccess === false || accessDenied === true).toBeTruthy();
  });
});
