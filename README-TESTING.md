# E2E Testing Guide

## Quick Start

**IMPORTANT**: Before running tests, you must create Firebase test users. See detailed instructions in [`e2e/TEST-SETUP.md`](e2e/TEST-SETUP.md).

## Setup

### 1. Install Playwright

```bash
npm install -D @playwright/test
npx playwright install chromium
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and add your test user credentials:

```bash
cp .env.example .env
```

Add these test credentials to your `.env` file:

```
TEST_MANAGER_EMAIL=manager@test.com
TEST_MANAGER_PASSWORD=testpassword123
TEST_JR_SALES_EMAIL=jrsales@test.com
TEST_JR_SALES_PASSWORD=testpassword123
```

### 3. Create Firebase Test Users

**This is required for tests to pass!** Follow the detailed guide in [`e2e/TEST-SETUP.md`](e2e/TEST-SETUP.md) to:

- Create test users in Firebase Authentication
- Assign custom claims (roles) using Firebase Admin SDK
- Verify user setup

### 4. Verify Setup

Ensure your dev server is running:

```bash
npm run dev
```

The Playwright config will automatically start the dev server if it's not running.

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/navigation.spec.js
```

## Test Coverage

See [`e2e/README.md`](e2e/README.md) for detailed test documentation.

### Core Functionality

- **Navigation Flow** (`navigation.spec.js`) - Tab navigation, layout persistence, no frozen content
- **Authentication** (`auth.spec.js`) - Login, logout, session persistence, invalid credentials
- **Spreadsheet Editing** (`spreadsheet.spec.js`) - Cell editing, keyboard navigation, save functionality

### Workflows

- **Approval Workflow** (`approval-workflow.spec.js`) - Jr_sales creates pending, manager approves
- **Rejection Workflow** (`rejection-workflow.spec.js`) - Manager rejects pending changes

### Features

- **Costs Display** (`costs-display.spec.js`) - Display all cost rows correctly
- **Month Filter** (`month-filter.spec.js`) - Month selector visibility, filtering, persistence
- **Deleted Orders** (`deleted-orders.spec.js`) - Deleted orders view, navigation, access control

### Security & Access Control

- **Role-based Access** (`role-access.spec.js`) - Navigation visibility, editing restrictions by role
- **Error Handling** (`error-handling.spec.js`) - Console error checks, network handling

## Test Files

All test files are located in the `e2e/` directory:

- `auth.spec.js` - Authentication and authorization tests
- `navigation.spec.js` - Navigation flow tests
- `approval-workflow.spec.js` - Approval workflow tests
- `rejection-workflow.spec.js` - Rejection workflow tests
- `spreadsheet.spec.js` - Spreadsheet editing tests
- `costs-display.spec.js` - Cost display tests
- `month-filter.spec.js` - Month filter tests
- `deleted-orders.spec.js` - Deleted orders tests
- `role-access.spec.js` - Role-based access control tests
- `error-handling.spec.js` - Error handling tests

## Notes

- Tests run sequentially (workers: 1) to avoid race conditions
- Dev server starts automatically before tests
- Screenshots captured on failure in `test-results/`
- HTML test report generated in `playwright-report/`
- All tests verify bug fixes and prevent regressions

## Troubleshooting

### Tests Fail with "Navigation timeout"

- Ensure Firebase test users are created (see `e2e/TEST-SETUP.md`)
- Verify `.env` file has correct test credentials
- Check that test users have proper role claims assigned

### Dev Server Won't Start

- Make sure port 5173 is not already in use
- Run `npm run dev` manually to check for errors
- Verify all dependencies are installed with `npm install`

### Tests Pass Locally but Fail in CI

- Ensure CI environment has `.env` configured
- Check that Chromium browser is installed in CI
- Verify Firebase project credentials are available
