// =============================================================================
// TYPE DEFINITIONS - Order Management System
// Based on: firestore_erd_v2.mermaid
// =============================================================================

// -----------------------------------------------------------------------------
// Role
// -----------------------------------------------------------------------------
export type UserRole = 'super_admin' | 'manager' | 'sr_sales' | 'jr_sales'

// -----------------------------------------------------------------------------
// User: /users/{uid}
// -----------------------------------------------------------------------------
export interface User {
  uid: string
  email: string
  displayName: string
  role: UserRole
  emailVerified: boolean
  rememberMe: boolean
  sessionExpiresAt: Date | null
  createdAt: Date
  lastLoginAt: Date | null
}

// -----------------------------------------------------------------------------
// Order: /orders/{orderId}
// -----------------------------------------------------------------------------
export type OrderStatus = 'active' | 'completed' | 'cancelled'

export interface Order {
  id: string
  month: string                       // YYYY-MM
  status: OrderStatus
  version: number                     // Optimistic locking (T-DATA-001)
  createdBy: string                   // User UID (denormalized)
  createdByName: string               // Denormalized display name
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null              // Soft delete marker (T-DATA-009)
  deletedBy: string | null            // UID of who deleted
  dynamic_fields: Record<string, unknown>  // Flexible schema {columnKey: value}
}

// -----------------------------------------------------------------------------
// Cost: /costs/{costId} [NEW]
// Identical structure to Order, restricted to Manager/Super Admin (T-AUTHZ-005)
// -----------------------------------------------------------------------------
export interface Cost {
  id: string
  month: string                       // YYYY-MM
  orderId: string | null              // Optional link to specific order
  status: OrderStatus
  version: number                     // Optimistic locking (T-DATA-001)
  createdBy: string                   // User UID (denormalized)
  createdByName: string               // Denormalized display name
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null              // Soft delete marker (T-DATA-009)
  deletedBy: string | null            // UID of who deleted
  dynamic_fields: Record<string, unknown>  // Flexible schema {columnKey: value}
}

// -----------------------------------------------------------------------------
// PendingChange: /pending_changes/{changeId}
// -----------------------------------------------------------------------------
export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'
export type TargetCollection = 'orders' | 'costs'

export interface PendingChange {
  id: string
  targetCollection: TargetCollection  // 'orders' or 'costs'
  targetId: string                    // Document ID in target collection
  orderId: string | null              // DEPRECATED: use targetId
  orderMonth: string                  // Denormalized YYYY-MM
  field: string                       // Column key from dynamic_fields
  baseValue: unknown                  // Snapshot of value at request time
  baseVersion: number                 // Order/Cost version at request time
  newValue: unknown                   // Proposed new value
  requestedBy: string                 // User UID
  requestedByName: string             // Denormalized display name
  requestedAt: Date
  status: PendingStatus
  statusUpdatedAt: Date | null
  reviewedBy: string | null           // Manager UID (null if pending)
  rejectionCount: number
  expiresAt: Date                     // Auto-reject after 7 days (T-DATA-003)
}

// -----------------------------------------------------------------------------
// ColumnDefinition: /column_definitions/{key}
// -----------------------------------------------------------------------------
export type ColumnType = 'text' | 'number' | 'date' | 'select'

export interface ColumnDefinition {
  key: string                         // Document ID = unique column identifier
  label: string                       // Human-readable name
  type: ColumnType
  order: number                       // Display order in spreadsheet
  options: string[]                   // For select type
  systemField: boolean                // true for id, month, status (non-deletable)
  isDataRelated: boolean              // true = type changes blocked if data exists (T-DATA-005)
  createdAt: Date
  updatedAt: Date
}

// -----------------------------------------------------------------------------
// ColumnPermission: permissions map entry in RolePermission
// -----------------------------------------------------------------------------
export interface ColumnPermission {
  visible: boolean
  editable: boolean
  requiresApproval: boolean
}

// -----------------------------------------------------------------------------
// RolePermission: /role_permissions/{role}
// -----------------------------------------------------------------------------
export interface RolePermission {
  role: UserRole                      // Document ID = role name
  permissions: Record<string, ColumnPermission>  // columnKey → permission
  updatedAt: Date
  updatedBy: string                   // Super Admin UID
}

// -----------------------------------------------------------------------------
// AuditLog: /audit_logs/{logId}
// Append-only (T-DATA-007), Super Admin read only (T-INFO-001)
// -----------------------------------------------------------------------------
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'recover'
  | 'permanent_delete'

export type AuditTargetCollection =
  | 'orders'
  | 'costs'
  | 'pending_changes'
  | 'users'
  | 'column_definitions'
  | 'role_permissions'

export interface AuditLog {
  id: string
  userId: string                      // Actor UID
  userName: string                    // Denormalized display name
  action: AuditAction
  targetCollection: AuditTargetCollection
  targetId: string                    // Document ID of affected resource
  details: Record<string, unknown>    // Redacted metadata (no sensitive values)
  timestamp: Date
}

// -----------------------------------------------------------------------------
// Store state helpers
// -----------------------------------------------------------------------------
export interface StoreError {
  code: string
  message: string
}

export interface VersionConflictError extends StoreError {
  code: 'version_conflict'
  localVersion: number
  serverVersion: number
}
