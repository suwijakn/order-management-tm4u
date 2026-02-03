# Threat Model - Order Management System (v2.1)

**Version:** 2.1 | **Threats:** 36 | **Critical:** 8 | **High:** 11

---

## Trust Boundaries
```
┌─────────────────────────────────────┐
│ UNTRUSTED: Browser (Vue App)        │
└───────────────┬─────────────────────┘
                ▼
┌─────────────────────────────────────┐
│ TRUST BOUNDARY: Firebase Rules      │
└───────────────┬─────────────────────┘
                ▼
┌─────────────────────────────────────┐
│ TRUSTED: Firestore, Cloud Functions │
└─────────────────────────────────────┘
```

---

## Critical Threats (Must Fix)

| ID | Threat | Mitigation |
|----|--------|------------|
| T-AUTH-001 | Session hijacking via XSS | HTTP-only cookies, CSP headers, HTTPS |
| T-AUTHZ-001 | Client-side auth bypass | **All checks server-side** in Firestore rules |
| T-AUTHZ-002 | Self role escalation | Users cannot modify own role; audit all changes |
| T-DATA-001 | Race condition (lost updates) | Optimistic locking: `version` field |
| T-DATA-002 | Pending approval race | Atomic transaction; one pending per cell |
| T-DATA-007 | Audit log tampering | Append-only, no UPDATE/DELETE permissions |
| T-AUTHZ-004 | Permission config tampering | Require 2nd Super Admin approval |
| T-LOGIC-001 | Completed order bypass | `if (order.status === 'completed') throw Error` |

---

## High Threats

| ID | Threat | Mitigation |
|----|--------|------------|
| T-AUTH-002 | Credential stuffing | Rate limit: 5 attempts/15min, CAPTCHA ~~, MFA for Manager+~~ [UPDATED - MFA removed] |
| T-AUTH-004 | **Persistent session theft** [NEW] | Secure cookie flags (HttpOnly, Secure, SameSite), token rotation on sensitive actions |
| T-AUTHZ-003 | Horizontal privilege (access others' data) | Filter queries by `userId`, verify ownership |
| T-AUTHZ-005 | **Cost data leak to Jr/Sr Sales** [NEW] | Firestore rules: `costs` collection readable only if role in ['manager', 'super_admin'] |
| T-DATA-003 | Stale pending (baseValue changed) | Expire after 7 days; show approver current value |
| T-DATA-004 | Force delete orphans pending | Transaction: void pendings + delete order together |
| T-DATA-005 | Column type change corruption | Block type change if `isDataRelated=true` AND data exists [UPDATED] |
| T-DATA-006 | Validation bypass via API | Server-side validation for all inputs |
| T-DATA-009 | **Accidental permanent data loss** [NEW] | 30-day soft delete recovery window, Manager UI to restore |
| T-DOS-001 | Real-time listener exhaustion | Paginate; max 10 updates/sec/user |
| T-DOS-002 | Pending queue flood | Rate limit: 20/hour/user, max 50 unresolved |

---

## Medium Threats

| ID | Threat | Mitigation |
|----|--------|------------|
| T-AUTH-003 | Long session expiration | Idle 30min (if remember me off), absolute 24hr timeout; **30-day if remember me enabled** [UPDATED] |
| T-AVAIL-001 | Disconnect without recovery | Auto-reconnect with exponential backoff |
| T-AVAIL-002 | Database lock contention | Short transactions (<1s), lock timeout 5s |
| T-LOGIC-003 | Approval bypass via withdraw/resubmit | Track rejection count, 1hr cooldown |
| T-INFO-002 | Real-time sync leaking data | Server-side filter before broadcast |
| T-DOS-003 | Malicious column creation | Hard limit: 100 columns |
| T-DOS-004 | Audit log flood | Rate limit, log rotation 90 days |
| T-INFO-001 | Sensitive data in audit | Redact values, role-based log access |
| T-INFO-003 | Error message info leak | Generic user errors, detailed server logs |
| T-LOGIC-002 | Circular pending dependencies | Detect cycles, require sequential approval |

---

## Attack Scenarios

### Scenario 1: Malicious Manager
1. Force-delete 50 critical orders
2. Cover tracks (voided pendings not notified)

**Defense:** Two-person force delete, soft delete with 30-day recovery, alert on >10 deletes/day, **recovery UI allows restoration** [UPDATED]

### Scenario 2: External Account Takeover
1. Credential stuffing → Editor account
2. Create malicious pendings
3. Exploit Manager trust

**Defense:** ~~MFA for Manager+~~ [REMOVED], rate limit, credential breach monitoring, CAPTCHA after failed attempts

### Scenario 3: Jr. Sales Cost Data Exfiltration [NEW]
1. Jr. Sales inspects network requests
2. Attempts direct Firestore API call to `costs` collection
3. Tries to infer cost data from orders

**Defense:** 
- Firestore security rules enforce role check: `allow read: if request.auth.token.role in ['manager', 'super_admin']`
- No cost references in order documents
- Audit log all cost collection access attempts

### Scenario 4: Persistent Session Hijacking [NEW]
1. Attacker steals remember-me token from victim's device
2. Uses token to maintain 30-day access

**Defense:**
- HttpOnly, Secure, SameSite=Strict cookie attributes
- IP address change triggers re-authentication for sensitive actions
- User can revoke all sessions from settings page

---

## Operational and Financial Risks

| ID | Category | Risk | Mitigation |
|----|----------|------|------------|
| T-OPS-001 | Operational | Bus Factor Deadlock: 2-person rule frozen if 1 Super Admin unavailable | Break Glass protocol with secure service account |
| T-OPS-002 | **Operational** | **Accidental column metadata lock** [NEW] | Allow display order/label changes via `isDataRelated=false` flag |
| T-FIN-001 | Financial | Read DoS: Month switching triggers massive Firestore reads | Pinia persistence + Firestore Bundles |
| T-UX-001 | Latency | ~~Cloud Function cold starts 2-5s delay~~ [REMOVED - MFA removed] | Optimistic UI updates in Vue |
| T-DATA-008 | Data Safety | Bad deployment corrupts data en masse | Enable PITR + daily GCS exports + 30-day soft delete recovery |

---

## Security Controls Summary

| Control | Implementation |
|---------|----------------|
| Auth | Firebase Auth ~~+ MFA (Manager+)~~ [UPDATED - MFA removed] |
| Persistent Sessions | Remember me: 30-day cookie with secure flags [NEW] |
| AuthZ | Firestore Rules (server-side) |
| Cost Data | Role-based read access (Manager + Super Admin only) [NEW] |
| Rate Limiting | Cloud Functions: 10 writes/min |
| Session | 30min idle / 24hr absolute (or 30 days if remember me) [UPDATED] |
| Validation | Cloud Functions + Firestore rules |
| Audit | Append-only, Super Admin access only |
| Column Editing | Type change blocked if isDataRelated=true AND data exists [UPDATED] |
| Soft Delete Recovery | 30-day window, Manager UI for restoration [NEW] |
| Encryption | TLS in transit, AES-256 at rest |
| CSP | Strict headers configured |

---

## Updated Mitigations Summary

### Changes from v2.0:
1. ✅ **Removed MFA requirement** - Simplified authentication flow
2. ✅ **Added persistent sessions** - 30-day remember me option with enhanced security
3. ✅ **Added cost data protection** - Role-based access control for cost collection
4. ✅ **Enhanced column editing** - Flexible metadata changes via isDataRelated flag
5. ✅ **Added soft delete recovery** - 30-day recovery window with UI
6. ✅ **New threat scenarios** - Cost data exfiltration, persistent session hijacking

### New Threat IDs:
- **T-AUTH-004**: Persistent session theft
- **T-AUTHZ-005**: Cost data leak to unauthorized roles
- **T-DATA-009**: Accidental permanent data loss
- **T-OPS-002**: Accidental column metadata lock
