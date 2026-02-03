# Order Management System - Tasks (v2.0)

## Project Setup
- [ ] Flow Analysis & Threat Modeling
- [ ] Initialize Vue 3 (Vite)
- [ ] Configure Firebase
- [ ] Setup Pinia & Router

## Authentication [T-AUTH-*]
- [ ] Firebase Auth (email/password)
- [ ] Email verification
- [ ] Password reset
- [ ] Rate limit login: 5/15min [T-AUTH-002]
- [ ] CAPTCHA after failures [T-AUTH-002]
- [ ] ~~MFA for Manager+~~ [REMOVED - not needed per requirement]
- [ ] Session timeout:
  - [ ] Remember me unchecked: 30min idle, 24hr absolute [T-AUTH-003]
  - [ ] **Remember me checked: 30-day persistent session** [NEW]
- [ ] HTTP-only cookies, CSP [T-AUTH-001]
- [ ] **"Remember me" checkbox on login form** [NEW]

## Authorization [T-AUTHZ-*]
- [ ] Firestore Security Rules:
  - [ ] Role check on ALL writes [T-AUTHZ-001]
  - [ ] Block self-role modification [T-AUTHZ-002]
  - [ ] Verify ownership [T-AUTHZ-003]
  - [ ] 2-person for permission changes [T-AUTHZ-004]
  - [ ] **Cost collection read restricted to Manager + Super Admin** [NEW]
- [ ] User Management UI (Super Admin)

## Data Integrity [T-DATA-*]
- [ ] Optimistic locking (version field) [T-DATA-001]
- [ ] Atomic pending create (Cloud Function) [T-DATA-002]
- [ ] One pending per cell constraint [T-DATA-002]
- [ ] Store baseValue, expire 7 days [T-DATA-003]
- [ ] Force delete → void pendings in transaction [T-DATA-004]
- [ ] Soft delete with 30-day recovery [T-DATA-004]
- [ ] **Column edit logic** [UPDATED]:
  - [ ] Add `isDataRelated` boolean field to column_definitions
  - [ ] Block type change if isDataRelated=true AND data exists [T-DATA-005]
  - [ ] **Allow metadata edits (display order, label) if isDataRelated=false** [NEW]
- [ ] Server-side input validation [T-DATA-006]
- [ ] Append-only audit logs [T-DATA-007]
- [ ] **Automatic purge of soft-deleted records after 30 days** [NEW]

## DoS Prevention [T-DOS-*]
- [ ] Rate limit writes: 10/min/user [T-DOS-001]
- [ ] Paginated real-time listeners [T-DOS-001]
- [ ] Max 50 unresolved pendings/user [T-DOS-002]
- [ ] Max 100 columns [T-DOS-003]
- [ ] Log rotation 90 days [T-DOS-004]

## Business Logic [T-LOGIC-*]
- [ ] Status-based locking (completed=read-only) [T-LOGIC-001]
- [ ] Track rejection count [T-LOGIC-003]
- [ ] 1hr cooldown after rejection [T-LOGIC-003]

## Availability [T-AVAIL-*]
- [ ] Auto-reconnect with backoff [T-AVAIL-001]
- [ ] Connection status indicator [T-AVAIL-001]
- [ ] Short transactions (<1s) [T-AVAIL-002]

## Core Features
- [ ] Dynamic Column Management
- [ ] Role Permission Config
- [ ] Spreadsheet with month selector
- [ ] **Cost row in spreadsheet** [NEW]:
  - [ ] Create `costs` collection in Firestore
  - [ ] Display cost row below order rows
  - [ ] Different styling for cost row
  - [ ] Manager + Super Admin only visibility
  - [ ] Same columns as order rows
- [ ] Add/Delete Row (Manager+)
- [ ] **Soft Delete Recovery UI** [NEW]:
  - [ ] Deleted orders view page
  - [ ] Filter by month and deletion date
  - [ ] "Recover" button to restore orders
  - [ ] "Permanent Delete" with confirmation
  - [ ] Manager + Super Admin access only
- [ ] Withdrawal flow
- [ ] Approval Dashboard

## Audit [T-INFO-*]
- [ ] Redact sensitive values [T-INFO-001]
- [ ] Super Admin only access [T-INFO-001]
- [ ] Filter real-time by permission [T-INFO-002]

## Operational and Infrastructure
- [ ] Break Glass protocol for Super Admin lockout [T-OPS-001]
- [ ] Pinia persistence for client caching [T-FIN-001]
- [ ] Firestore Bundles for month data [T-FIN-001]
- [ ] Optimistic UI updates [T-UX-001]
- [ ] Enable Point-in-Time Recovery [T-DATA-008]
- [ ] Daily GCS backup exports [T-DATA-008]

## New Features Summary
1. ✅ **Soft Delete Recovery UI**: Manager can recover deleted orders within 30 days
2. ✅ **Flexible Column Editing**: Metadata changes (display order, label) allowed even with data
3. ✅ **Remember Me**: Persistent 30-day sessions when enabled
4. ✅ **Removed MFA**: No MFA requirement (simplified authentication)
5. ✅ **Cost Row**: Separate row in spreadsheet visible only to Manager + Super Admin
