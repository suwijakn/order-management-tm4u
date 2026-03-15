/**
 * Helper function for robust login in E2E tests
 * Handles waiting for navigation and provides better error messages
 */
export async function login(page, email, password) {
  await page.goto('/login');
  
  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Click submit
  await page.click('button[type="submit"]');
  
  // Wait for either successful navigation or error message
  try {
    await Promise.race([
      page.waitForURL('/dashboard', { timeout: 10000 }),
      page.waitForSelector('.text-red-600', { timeout: 10000 }).then(() => {
        throw new Error(`Login failed for ${email}. Check that the user exists in Firebase and credentials are correct.`);
      })
    ]);
  } catch (error) {
    // If we timeout, check if we're on dashboard anyway
    if (page.url().includes('/dashboard')) {
      return; // Success
    }
    
    // Check for error message
    const errorMsg = await page.locator('.text-red-600').textContent().catch(() => null);
    if (errorMsg) {
      throw new Error(`Login failed: ${errorMsg}`);
    }
    
    throw error;
  }
}

/**
 * Login with default test credentials from environment
 */
export async function loginAsManager(page) {
  const email = process.env.TEST_MANAGER_EMAIL;
  const password = process.env.TEST_MANAGER_PASSWORD;
  
  if (!email || !password) {
    throw new Error('TEST_MANAGER_EMAIL and TEST_MANAGER_PASSWORD must be set in .env.test file');
  }
  
  await login(page, email, password);
}

export async function loginAsJrSales(page) {
  const email = process.env.TEST_JR_SALES_EMAIL;
  const password = process.env.TEST_JR_SALES_PASSWORD;
  
  if (!email || !password) {
    throw new Error('TEST_JR_SALES_EMAIL and TEST_JR_SALES_PASSWORD must be set in .env.test file');
  }
  
  await login(page, email, password);
}

export async function loginAsSuperAdmin(page) {
  const email = process.env.TEST_SUPER_ADMIN_EMAIL;
  const password = process.env.TEST_SUPER_ADMIN_PASSWORD;
  
  if (!email || !password) {
    throw new Error('TEST_SUPER_ADMIN_EMAIL and TEST_SUPER_ADMIN_PASSWORD must be set in .env.test file');
  }
  
  await login(page, email, password);
}
