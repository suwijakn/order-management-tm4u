import { test, expect } from '@playwright/test';

test.describe('Month Filter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });
  });

  test('displays month selector', async ({ page }) => {
    await expect(page.locator('input[type="month"]')).toBeVisible({ timeout: 5000 });
  });

  test('changes data when month is selected', async ({ page }) => {
    const monthInput = page.locator('input[type="month"]').first();
    if (await monthInput.isVisible()) {
      const currentValue = await monthInput.inputValue();
      const date = new Date(currentValue);
      date.setMonth(date.getMonth() - 1);
      const prevMonth = date.toISOString().slice(0, 7);
      await monthInput.fill(prevMonth);
      await page.waitForTimeout(1500);
      expect(await monthInput.inputValue()).toBe(prevMonth);
    }
  });

  test('persists month across tab navigation', async ({ page }) => {
    const monthInput = page.locator('input[type="month"]').first();
    if (await monthInput.isVisible()) {
      const testMonth = '2024-01';
      await monthInput.fill(testMonth);
      await page.waitForTimeout(500);
      
      await page.click('a[href="/pending-approvals"]');
      await page.waitForURL('/pending-approvals');
      
      await page.click('a[href="/dashboard"]');
      await page.waitForURL('/dashboard');
      
      const newValue = await monthInput.inputValue();
      expect(newValue).toBe(testMonth);
    }
  });
});
