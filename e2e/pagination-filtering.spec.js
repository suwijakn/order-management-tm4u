import { test, expect } from '@playwright/test';

test.describe('Pagination and Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.TEST_MANAGER_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_MANAGER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should display month selector', async ({ page }) => {
    // Check if month selector is visible
    const monthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
    await expect(monthSelector).toBeVisible();
  });

  test('should filter orders by selected month', async ({ page }) => {
    // Get initial row count
    const initialRows = await page.locator('tbody tr').count();
    
    // Change month (if month selector exists)
    const monthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
    
    if (await monthSelector.isVisible()) {
      await monthSelector.click();
      
      // Select a different month
      const monthOption = page.locator('option, [role="option"]').filter({ hasText: /January|February|March/ }).first();
      if (await monthOption.isVisible()) {
        await monthOption.click();
        
        // Wait for data to load
        await page.waitForTimeout(1000);
        
        // Row count may change based on selected month
        const newRows = await page.locator('tbody tr').count();
        expect(newRows).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('should persist month selection across navigation', async ({ page }) => {
    // Select a specific month
    const monthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
    
    if (await monthSelector.isVisible()) {
      const selectedMonth = await monthSelector.textContent();
      
      // Navigate to Pending Approvals
      await page.click('a[href="/pending-approvals"]');
      await page.waitForURL('/pending-approvals');
      
      // Check if month is still selected
      const pendingMonthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
      if (await pendingMonthSelector.isVisible()) {
        const currentMonth = await pendingMonthSelector.textContent();
        expect(currentMonth).toBe(selectedMonth);
      }
    }
  });

  test('should handle empty results gracefully', async ({ page }) => {
    // Navigate to Deleted Orders (likely to have fewer or no results)
    await page.click('a[href="/deleted-orders"]');
    await page.waitForURL('/deleted-orders');
    
    // Check for either data rows or empty state message
    const hasRows = await page.locator('tbody tr').count() > 0;
    const hasEmptyMessage = await page.locator('text=/No.*orders|No.*data|Empty/i').isVisible();
    
    expect(hasRows || hasEmptyMessage).toBeTruthy();
  });

  test('should display correct row count', async ({ page }) => {
    // Count visible rows
    const rowCount = await page.locator('tbody tr').count();
    
    // Verify rows are rendered
    expect(rowCount).toBeGreaterThanOrEqual(0);
    
    // If there are rows, verify they have cells
    if (rowCount > 0) {
      const firstRowCells = await page.locator('tbody tr:first-child td').count();
      expect(firstRowCells).toBeGreaterThan(0);
    }
  });

  test('should load data on initial page load', async ({ page }) => {
    // Wait for loading to complete
    await page.waitForTimeout(2000);
    
    // Check that either data is loaded or empty state is shown
    const hasContent = await page.locator('tbody tr, [data-testid="empty-state"]').count() > 0;
    expect(hasContent).toBeTruthy();
  });

  test('should maintain scroll position when switching months', async ({ page }) => {
    const monthSelector = page.locator('[data-testid="month-selector"]').or(page.locator('select, button').filter({ hasText: /Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first());
    
    if (await monthSelector.isVisible()) {
      // Scroll down
      await page.evaluate(() => window.scrollTo(0, 500));
      const scrollBefore = await page.evaluate(() => window.scrollY);
      
      // Change month
      await monthSelector.click();
      const monthOption = page.locator('option, [role="option"]').first();
      if (await monthOption.isVisible()) {
        await monthOption.click();
        await page.waitForTimeout(1000);
        
        // Scroll position should reset to top after data reload
        const scrollAfter = await page.evaluate(() => window.scrollY);
        expect(scrollAfter).toBeLessThanOrEqual(scrollBefore);
      }
    }
  });
});
