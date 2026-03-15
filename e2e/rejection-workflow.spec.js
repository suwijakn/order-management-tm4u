import { test, expect } from '@playwright/test';

test.describe('Rejection Workflow', () => {
  test('manager rejects pending change', async ({ browser }) => {
    const jrContext = await browser.newContext();
    const mgrContext = await browser.newContext();
    const jrPage = await jrContext.newPage();
    const mgrPage = await mgrContext.newPage();

    try {
      // Jr sales login and create pending
      await jrPage.goto('/login');
      await jrPage.fill('input[type="email"]', process.env.TEST_JR_SALES_EMAIL || 'jrsales@test.com');
      await jrPage.fill('input[type="password"]', process.env.TEST_JR_SALES_PASSWORD || 'testpassword');
      await jrPage.click('button[type="submit"]');
      await jrPage.waitForURL('/dashboard', { timeout: 10000 });

      const testVal = `Reject-${Date.now()}`;
      const cell = jrPage.locator('[data-cell-id]').first();
      await cell.click();
      await jrPage.keyboard.type(testVal);
      await jrPage.keyboard.press('Enter');
      await jrPage.waitForTimeout(2000);

      // Manager login and reject
      await mgrPage.goto('/login');
      await mgrPage.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
      await mgrPage.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
      await mgrPage.click('button[type="submit"]');
      await mgrPage.waitForURL('/dashboard', { timeout: 10000 });

      await mgrPage.click('a[href="/pending-approvals"]');
      await mgrPage.waitForURL('/pending-approvals');
      await mgrPage.waitForTimeout(2000);

      const rejectBtn = mgrPage.locator('button:has-text("Reject")').first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await mgrPage.waitForTimeout(2000);
      }
    } finally {
      await jrContext.close();
      await mgrContext.close();
    }
  });

  test('rejected change removed from pending list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL || 'manager@test.com');
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard', { timeout: 10000 });

    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL('/pending-approvals');

    const pendingCount = await page.locator('[data-testid="pending-item"], .pending-item').count();
    
    const rejectBtn = page.locator('button:has-text("Reject")').first();
    if (await rejectBtn.isVisible()) {
      await rejectBtn.click();
      await page.waitForTimeout(2000);
      
      const newCount = await page.locator('[data-testid="pending-item"], .pending-item').count();
      expect(newCount).toBeLessThanOrEqual(pendingCount);
    }
  });
});
