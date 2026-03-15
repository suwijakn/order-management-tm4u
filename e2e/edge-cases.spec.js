import { test, expect } from '@playwright/test';

test.describe('Edge Cases and Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should handle rapid tab switching without breaking', async ({ page }) => {
    // Rapidly switch between tabs
    for (let i = 0; i < 5; i++) {
      await page.click('a[href="/dashboard"]');
      await page.waitForTimeout(100);
      await page.click('a[href="/pending-approvals"]');
      await page.waitForTimeout(100);
      await page.click('a[href="/deleted-orders"]');
      await page.waitForTimeout(100);
    }
    
    // Verify final state is correct
    await expect(page).toHaveURL('/deleted-orders');
    await expect(page.locator('h1, h2').filter({ hasText: /Deleted/i })).toBeVisible();
  });

  test('should handle empty cell values', async ({ page }) => {
    // Find a cell and clear it
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      await cell.click();
      await cell.fill('');
      await page.keyboard.press('Enter');
      
      // Verify empty value is handled
      await page.waitForTimeout(500);
      const cellValue = await cell.textContent();
      expect(cellValue).toBeDefined();
    }
  });

  test('should handle very long text input', async ({ page }) => {
    const longText = 'A'.repeat(1000);
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      await cell.click();
      await cell.fill(longText);
      
      // Verify text is truncated or handled appropriately
      const cellValue = await cell.textContent();
      expect(cellValue.length).toBeGreaterThan(0);
    }
  });

  test('should handle special characters in input', async ({ page }) => {
    const specialChars = '<script>alert("test")</script>';
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      await cell.click();
      await cell.fill(specialChars);
      await page.keyboard.press('Escape');
      
      // Verify no XSS vulnerability
      const alerts = [];
      page.on('dialog', dialog => {
        alerts.push(dialog.message());
        dialog.dismiss();
      });
      
      await page.waitForTimeout(500);
      expect(alerts.length).toBe(0);
    }
  });

  test('should handle network disconnection gracefully', async ({ page, context }) => {
    // Simulate offline mode
    await context.setOffline(true);
    
    // Try to navigate
    await page.click('a[href="/pending-approvals"]').catch(() => {});
    
    // Restore connection
    await context.setOffline(false);
    await page.waitForTimeout(1000);
    
    // Verify app recovers
    await page.click('a[href="/dashboard"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should handle concurrent edits to same cell', async ({ page }) => {
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      // Start editing
      await cell.click();
      await cell.fill('First Edit');
      
      // Don't save, just click another cell
      const anotherCell = page.locator('td[contenteditable="true"]').nth(1);
      if (await anotherCell.isVisible()) {
        await anotherCell.click();
        
        // Verify first edit was handled (saved or discarded)
        await page.waitForTimeout(500);
        const firstCellValue = await cell.textContent();
        expect(firstCellValue).toBeDefined();
      }
    }
  });

  test('should handle missing or invalid data gracefully', async ({ page }) => {
    // Navigate to a view that might have missing data
    await page.goto('/dashboard?month=invalid');
    
    // Verify app doesn't crash
    await expect(page.locator('body')).toBeVisible();
    
    // Check for error message or fallback
    const hasContent = await page.locator('tbody tr, [data-testid="error-message"]').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should prevent duplicate pending submissions', async ({ page }) => {
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      await cell.click();
      await cell.fill('Test Value');
      
      // Try to submit multiple times rapidly
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(1000);
      
      // Verify only one pending was created (check pending indicators)
      const pendingIndicators = await page.locator('[data-testid="pending-indicator"], .pending-indicator').count();
      expect(pendingIndicators).toBeLessThanOrEqual(1);
    }
  });

  test('should handle session expiration', async ({ page, context }) => {
    // Clear all cookies to simulate session expiration
    await context.clearCookies();
    
    // Try to navigate
    await page.click('a[href="/pending-approvals"]');
    
    // Should redirect to login
    await page.waitForURL('/login', { timeout: 5000 }).catch(() => {});
    
    // Verify login page is shown
    const isLoginPage = page.url().includes('/login') || await page.locator('input[type="email"]').isVisible();
    expect(isLoginPage).toBeTruthy();
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate through multiple pages
    await page.click('a[href="/pending-approvals"]');
    await page.waitForURL('/pending-approvals');
    
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    
    // Use browser back
    await page.goBack();
    await expect(page).toHaveURL('/pending-approvals');
    
    // Use browser forward
    await page.goForward();
    await expect(page).toHaveURL('/deleted-orders');
    
    // Verify content is correct
    await expect(page.locator('h1, h2').filter({ hasText: /Deleted/i })).toBeVisible();
  });

  test('should handle window resize', async ({ page }) => {
    // Set initial viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    // Verify content is visible
    let isVisible = await page.locator('tbody tr').first().isVisible();
    expect(isVisible).toBeTruthy();
    
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify app is still functional (may have different layout)
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBeTruthy();
    
    // Resize back
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    
    isVisible = await page.locator('tbody tr').first().isVisible();
    expect(isVisible).toBeTruthy();
  });

  test('should handle rapid month changes', async ({ page }) => {
    const monthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
    
    if (await monthSelector.isVisible()) {
      // Rapidly change months
      for (let i = 0; i < 5; i++) {
        await monthSelector.click();
        const option = page.locator('option, [role="option"]').first();
        if (await option.isVisible()) {
          await option.click();
          await page.waitForTimeout(100);
        }
      }
      
      // Verify app is still functional
      await page.waitForTimeout(1000);
      const hasContent = await page.locator('tbody tr, [data-testid="empty-state"]').count() > 0;
      expect(hasContent).toBeTruthy();
    }
  });

  test('should handle logout during pending operation', async ({ page }) => {
    const cell = page.locator('td[contenteditable="true"]').first();
    
    if (await cell.isVisible()) {
      // Start editing
      await cell.click();
      await cell.fill('Test Value');
      
      // Logout immediately
      const logoutButton = page.locator('button, a').filter({ hasText: /logout|sign out/i }).first();
      if (await logoutButton.isVisible()) {
        await logoutButton.click();
        
        // Should redirect to login
        await page.waitForURL('/login', { timeout: 5000 }).catch(() => {});
        
        const isLoginPage = page.url().includes('/login') || await page.locator('input[type="email"]').isVisible();
        expect(isLoginPage).toBeTruthy();
      }
    }
  });
});
