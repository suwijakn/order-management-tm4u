# E2E Test Setup Guide

## Prerequisites

Before running the e2e tests, you need to create test users in Firebase Authentication with the appropriate roles.

## Step 1: Create Test Users in Firebase

### 1. Go to Firebase Console
- Navigate to: https://console.firebase.google.com/
- Select your project: `order-management-system-tm4u`
- Go to **Authentication** → **Users**

### 2. Create Manager Test User
Click **Add User** and create:
- **Email:** `manager@test.com`
- **Password:** `testpassword123`
- Click **Add User**

### 3. Create Jr Sales Test User
Click **Add User** and create:
- **Email:** `jrsales@test.com`
- **Password:** `testpassword123`
- Click **Add User**

## Step 2: Set Custom Claims (Roles)

You need to set custom claims for these users to assign their roles.

### Option A: Using Firebase CLI (Recommended)

1. Install Firebase CLI if not already installed:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Run the following commands to set custom claims:

**For Manager:**
```bash
firebase auth:set-custom-claims manager@test.com '{"role":"manager"}' --project order-management-system-tm4u
```

**For Jr Sales:**
```bash
firebase auth:set-custom-claims jrsales@test.com '{"role":"jr_sales"}' --project order-management-system-tm4u
```

### Option B: Using Cloud Functions

If you have a Cloud Function to set roles, call it with these user IDs.

### Option C: Using Firebase Admin SDK Script

Create a temporary script `set-test-roles.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path-to-service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setRoles() {
  // Get users by email
  const managerUser = await admin.auth().getUserByEmail('manager@test.com');
  const jrSalesUser = await admin.auth().getUserByEmail('jrsales@test.com');

  // Set custom claims
  await admin.auth().setCustomUserClaims(managerUser.uid, { role: 'manager' });
  await admin.auth().setCustomUserClaims(jrSalesUser.uid, { role: 'jr_sales' });

  console.log('Roles set successfully!');
  process.exit(0);
}

setRoles().catch(console.error);
```

Run it:
```bash
node set-test-roles.js
```

## Step 3: Configure Environment Variables

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Verify the test credentials in `.env`:
```env
TEST_MANAGER_EMAIL="manager@test.com"
TEST_MANAGER_PASSWORD="testpassword123"
TEST_JR_SALES_EMAIL="jrsales@test.com"
TEST_JR_SALES_PASSWORD="testpassword123"
```

## Step 4: Verify Email (Optional)

If your app requires email verification:

1. Go to Firebase Console → Authentication → Users
2. Click on each test user
3. Mark their email as verified

## Step 5: Run Tests

Now you can run the e2e tests:

```bash
# Run all tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/auth.spec.js
```

## Troubleshooting

### Tests fail with "Timeout waiting for /dashboard"
- **Cause:** Test users don't exist or credentials are wrong
- **Solution:** Verify users exist in Firebase Authentication and credentials match `.env`

### Tests fail with "Permission denied"
- **Cause:** Custom claims (roles) not set
- **Solution:** Follow Step 2 to set custom claims

### Tests fail with "Email not verified"
- **Cause:** Email verification required but not set
- **Solution:** Follow Step 4 to verify emails

### Network errors
- **Cause:** Firebase project not accessible
- **Solution:** Check Firebase configuration in `.env`

## Test User Roles Summary

| User | Email | Role | Permissions |
|------|-------|------|-------------|
| Manager | manager@test.com | `manager` | Full access: edit directly, approve/reject, view costs, view deleted orders |
| Jr Sales | jrsales@test.com | `jr_sales` | Limited: edits create pending requests, cannot approve, cannot view costs/deleted |

## Security Note

⚠️ **Important:** These are test credentials for local development only. Never use these in production. Keep your `.env` file in `.gitignore`.
