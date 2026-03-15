# E2E Test Suite Documentation

## Overview
This directory contains end-to-end tests for the TM4U Order Management system using Playwright.

## Test Files

### 1. `auth.spec.js` - Authentication & Authorization
**Tests:**
- ✅ Redirect unauthenticated users to login
- ✅ Login with valid credentials
- ✅ Show error for invalid credentials
- ✅ Logout successfully
- ✅ Session persists after refresh
- ✅ jr_sales cannot see cost rows (authorization)
- ✅ Manager can see cost rows (authorization)

### 2. `navigation.spec.js` - Navigation Flow
**Tests:**
- ✅ Navigate between tabs without content freezing
- ✅ Maintain layout during navigation
- ✅ No columnsStore errors on Deleted Orders tab

### 3. `approval-workflow.spec.js` - Approval Workflow
**Tests:**
- ✅ jr_sales creates pending and manager approves
- ✅ Manager can approve multiple items without refresh
- ✅ jr_sales can create pending on previously resolved doc

### 4. `rejection-workflow.spec.js` - Rejection Workflow
**Tests:**
- ✅ Manager rejects pending change
- ✅ Rejected change removed from pending list

### 5. `costs-display.spec.js` - Costs Display
**Tests:**
- ✅ Display all costs, not just the first one

### 6. `spreadsheet.spec.js` - Spreadsheet Functionality
**Tests:**
- ✅ Click cell to edit
- ✅ Type and save with Enter
- ✅ Navigate cells with arrow keys
- ✅ Display pending indicator after jr_sales edit

### 7. `month-filter.spec.js` - Month Filter
**Tests:**
- ✅ Displays month selector
- ✅ Changes data when month is selected
- ✅ Persists month across tab navigation

### 8. `deleted-orders.spec.js` - Deleted Orders View
**Tests:**
- ✅ Loads deleted orders view
- ✅ No JS errors on deleted orders page
- ✅ Can navigate away and back
- ✅ jr_sales cannot access deleted orders

### 9. `role-access.spec.js` - Role-Based Access Control
**Tests:**
- ✅ Manager sees all navigation items
- ✅ jr_sales has limited navigation
- ✅ Manager can edit cells directly
- ✅ jr_sales edits create pending requests

### 10. `error-handling.spec.js` - Error Handling
**Tests:**
- ✅ No console errors on dashboard load
- ✅ No console errors during navigation
- ✅ Handles network timeout gracefully
- ✅ Shows loading state

## Running Tests

### Run all tests
```bash
npm run test:e2e
```

### Run tests with UI
```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Run specific test file
```bash
npx playwright test e2e/navigation.spec.js
```

## Environment Variables

Create a `.env` file in the root directory with test credentials:

```env
TEST_MANAGER_EMAIL=manager@test.com
TEST_MANAGER_PASSWORD=testpassword
TEST_JR_SALES_EMAIL=jrsales@test.com
TEST_JR_SALES_PASSWORD=testpassword
```

## Configuration

- **Test Directory:** `./e2e`
- **Base URL:** `http://localhost:5173`
- **Workers:** 1 (sequential execution to avoid conflicts)
- **Retries:** 2 in CI, 0 locally
- **Reporter:** HTML report
- **Web Server:** Auto-starts dev server before tests

## Test Coverage

All major bug fixes from the development session are covered:
1. ✅ Navigation from Deleted Orders (no frozen content)
2. ✅ Manager approval workflow (no refresh needed)
3. ✅ jr_sales permission on resolved docs
4. ✅ All costs displayed (not just first)
5. ✅ columnsStore.fetchDefinitions error fixed

## Notes

- Tests run sequentially (workers: 1) to avoid race conditions with Firebase
- Each test suite has proper setup/teardown
- Screenshots captured on failure
- Trace recorded on first retry
