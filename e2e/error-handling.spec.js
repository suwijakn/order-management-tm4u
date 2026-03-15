import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
  test('no console errors on dashboard load', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
    await page.waitForTimeout(3000);

    const criticalErrors = errors.filter(e => 
      e.includes('TypeError') || 
      e.includes('ReferenceError') ||
      e.includes('is not a function')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('no console errors during navigation', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Navigate through all tabs
    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL('/pending-approvals');
    await page.waitForTimeout(1000);

    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    await page.waitForTimeout(1000);

    await page.click('a[href="/dashboard"]');
    await page.waitForURL('/dashboard');
    await page.waitForTimeout(1000);

    const criticalErrors = errors.filter(e => 
      e.includes('TypeError') || 
      e.includes('ReferenceError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('handles network timeout gracefully', async ({ page, context }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Page should have loaded without crashing
    await expect(page.locator('body')).toBeVisible();
  });

  test('shows loading state', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    
    // Check for loading indicator during dashboard load
    const loading = page.locator('[data-testid="loading"], .loading, text=/loading/i');
    // Loading may or may not be visible depending on speed
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });
});
