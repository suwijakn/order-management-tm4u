# Implementation Plan - Order Management System (v2.0)

## Goal
Secure, collaborative spreadsheet with RBAC, approval workflow, and audit logging.

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vue 3, Vite, Pinia |
| Backend | Firebase Auth, Firestore, Cloud Functions |

---

## Data Model

### Collections
- `users`: uid, email, role, displayName
- `column_definitions`: key (unique lowercase), label, type, order, **isDataRelated** (new field)
- `role_permissions`: role, permissions (map of columnKey → {visible, editable, requiresApproval})
- `orders`: id, month, status, version, createdBy, deletedAt (soft delete), ...fields
- `costs`: id, month, orderId (reference), version, createdBy, deletedAt (soft delete), ...fields (new collection)
- `pending_changes`: orderId, field, baseValue, baseVersion, newValue, requestedBy, status, rejectionCount, expiresAt
- `audit_logs`: userId, action, details (redacted), timestamp

---

## Security Implementation

### Authentication
- Email/password + verification
- **Remember me option** (30-day persistent session) [NEW]
- ~~MFA required for Manager and Super Admin~~ [REMOVED per request]
- Rate limit: 5 login attempts/15min [T-AUTH-002]
- Session: 30min idle (if remember me not checked), 24hr absolute [T-AUTH-003]
- Persistent session: 30 days (if remember me checked) [NEW]

### Authorization (Firestore Rules)
- All permission checks server-side [T-AUTHZ-001]
- Block: `users/{uid}` write if `request.auth.uid !== SuperAdmin` [T-AUTHZ-002]
- Verify ownership: `pending.requestedBy === request.auth.uid` [T-AUTHZ-003]
- **Cost row visibility**: Only Manager and Super Admin can see cost rows [NEW]

### Data Integrity
- `orders` & `costs`: version increment required [T-DATA-001]
- `pending_changes`: unique constraint on (orderId, field, status=pending) [T-DATA-002]
- Soft delete: set `deletedAt` instead of delete [T-DATA-004]
- **Column type change**: blocked if `isDataRelated=true` AND any order/cost has data in column [T-DATA-005] [UPDATED]
- **Column metadata changes**: allowed even with data if `isDataRelated=false` (e.g., display order, label) [NEW]

### Rate Limiting (Cloud Functions)
- Writes: 10/min/user [T-DOS-001]
- Pending creation: 20/hour/user [T-DOS-002]

---

## Critical Workflows

### Approval with baseValue Check
```
1. Editor submits: store baseValue, baseVersion
2. Approver reviews: show if value changed since
3. Approve: verify baseVersion matches current, then update
```

### Force Delete
```
1. Manager confirms (shows pending count)
2. Transaction: void pendings → soft delete order
3. 30-day recovery window
4. UI shows "Recover" button for soft-deleted orders
```

### Soft Delete Recovery (NEW)
```
1. Manager/Super Admin views deleted orders
2. Click "Recover" on soft-deleted order
3. Transaction: clear deletedAt timestamp
4. Order becomes active again
```

### Column Management (UPDATED)
```
Two types of column edits:
1. Data-related (isDataRelated=true):
   - Field type changes (text→number, etc.)
   - Requires: No data exists in any order/cost row
   
2. Metadata-only (isDataRelated=false):
   - Display order changes
   - Label/name changes
   - Always allowed, even with existing data
```

### Two-Person Integrity
- Permission changes require 2nd Super Admin
- Force delete of >5 rows requires confirmation

---

## UI Components (NEW/UPDATED)

### Spreadsheet View
- **Order rows**: Visible to all roles (based on column permissions)
- **Cost row**: Single row per month, displayed below order rows
  - Visible only to Manager and Super Admin
  - Same columns as order rows
  - Different styling (e.g., highlighted background)
  - Edit permissions: Manager and Super Admin only
  - Follows same approval workflow if configured

### Deleted Orders View (NEW)
- Accessible by Manager and Super Admin
- Filters: By month, by deleted date
- Shows: Order ID, month, deleted by, deleted at
- Actions:
  - "Recover" button → Clears deletedAt timestamp
  - "Permanent Delete" → Actually deletes (requires confirmation)
- 30-day automatic purge of soft-deleted records

### Column Management (UPDATED)
- Edit column dialog shows:
  - Type: text|number|date|select
  - Label: Human-readable name
  - Display Order: Integer for sorting
  - **Is Data-Related**: Checkbox (default: true)
- Validation:
  - If isDataRelated=true AND data exists → block type change
  - If isDataRelated=false → allow all edits

### Login Page (UPDATED)
- Email/password fields
- **"Remember me" checkbox** (NEW)
  - Checked: 30-day persistent session
  - Unchecked: 30min idle, 24hr absolute timeout
- Forgot password link
- ~~MFA code input (for Manager+)~~ [REMOVED]

---

## Operational Considerations

### Break Glass Protocol [T-OPS-001]
- Service account key stored in secure physical location
- Documented emergency procedure to bypass 2-person rule

### Performance [T-UX-001, T-FIN-001]
- Optimistic UI: Show change immediately, revert on failure
- Pinia persistence: Cache month data locally
- Firestore Bundles: Precompute monthly snapshots

### Backup [T-DATA-008]
- Enable Firestore PITR (7-day window)
- Daily exports to GCS bucket
- Soft-deleted records retained for 30 days before permanent deletion

---

## Verification
1. Jr. Sales direct API call → denied by rules
2. Session expires after 30min idle (if remember me unchecked)
3. Concurrent edit → version conflict shown
4. Force delete → pendings voided, recoverable 30 days
5. **Cost row not visible to Jr. Sales and Sr. Sales** (NEW)
6. **Column display order change allowed with existing data** (NEW)
7. **Recover soft-deleted order restores it to active** (NEW)
