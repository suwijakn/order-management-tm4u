/**
 * Centralized Audit Logging Service
 * Implements T-DATA-007 (append-only audit trail) and T-INFO-001 (value redaction)
 */

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuthStore } from "@/stores/auth";

/**
 * Action types for audit logging
 */
export const AuditAction = {
  // Order actions
  ORDER_CREATE: "order_create",
  ORDER_UPDATE: "order_update",
  ORDER_DELETE: "order_delete",
  ORDER_RECOVER: "order_recover",
  ORDER_PERMANENT_DELETE: "order_permanent_delete",
  
  // Cost actions
  COST_CREATE: "cost_create",
  COST_UPDATE: "cost_update",
  COST_DELETE: "cost_delete",
  
  // Pending actions
  PENDING_CREATE: "pending_create",
  PENDING_APPROVE: "pending_approve",
  PENDING_REJECT: "pending_reject",
  PENDING_WITHDRAW: "pending_withdraw",
  PENDING_AUTO_EXPIRE: "pending_auto_expire",
  
  // Column actions
  COLUMN_CREATE: "column_create",
  COLUMN_UPDATE: "column_update",
  COLUMN_DELETE: "column_delete",
  COLUMN_REORDER: "column_reorder",
  COLUMN_CLEAR_DATA: "column_clear_data",
  
  // Auth actions
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  LOGOUT: "logout",
};

/**
 * Fields that should never be logged
 */
const BLOCKED_FIELDS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "secret",
];

/**
 * Fields that should be redacted (partial masking)
 */
const REDACT_FIELDS = [
  "email",
  "phone",
  "address",
];

/**
 * Redact email: john.doe@example.com → j****@***.com
 * @param {string} email 
 * @returns {string}
 */
function redactEmail(email) {
  if (!email || typeof email !== "string") return "[INVALID]";
  
  const parts = email.split("@");
  if (parts.length !== 2) return "[INVALID]";
  
  const [local, domain] = parts;
  const domainParts = domain.split(".");
  
  const redactedLocal = local.charAt(0) + "****";
  const redactedDomain = "***." + domainParts[domainParts.length - 1];
  
  return `${redactedLocal}@${redactedDomain}`;
}

/**
 * Redact phone: 0891234567 → 089****567
 * @param {string} phone 
 * @returns {string}
 */
function redactPhone(phone) {
  if (!phone || typeof phone !== "string") return "[INVALID]";
  
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return "[REDACTED]";
  
  return digits.slice(0, 3) + "****" + digits.slice(-3);
}

/**
 * Redact a value based on its field name
 * @param {string} fieldName 
 * @param {any} value 
 * @returns {any}
 */
function redactValue(fieldName, value) {
  const lowerField = fieldName.toLowerCase();
  
  // Block sensitive fields entirely
  if (BLOCKED_FIELDS.some(f => lowerField.includes(f))) {
    return "[BLOCKED]";
  }
  
  // Redact specific fields
  if (lowerField.includes("email")) {
    return redactEmail(value);
  }
  
  if (lowerField.includes("phone")) {
    return redactPhone(value);
  }
  
  if (lowerField.includes("address")) {
    return "[REDACTED]";
  }
  
  // Return value as-is for non-sensitive fields
  return value;
}

/**
 * Recursively redact sensitive values in an object
 * @param {object} obj 
 * @returns {object}
 */
function redactObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(item => redactObject(item));
  
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null) {
      redacted[key] = redactObject(value);
    } else {
      redacted[key] = redactValue(key, value);
    }
  }
  return redacted;
}

/**
 * Create an audit log entry
 * 
 * @param {string} action - Action type from AuditAction
 * @param {string} targetCollection - Collection being acted upon (orders, costs, etc.)
 * @param {string} targetId - Document ID being acted upon
 * @param {object} details - Additional details (will be redacted)
 * @returns {Promise<string|null>} - Document ID or null on failure
 */
export async function createAuditLog(action, targetCollection, targetId, details = {}) {
  const authStore = useAuthStore();
  
  try {
    // Get current user info
    const userId = authStore.user?.uid || "system";
    const userName = authStore.user?.displayName || authStore.userEmail || "System";
    const userRole = authStore.userRole || "unknown";
    
    // Redact sensitive values in details
    const redactedDetails = redactObject(details);
    
    const logEntry = {
      // Who
      userId,
      userName,
      userRole,
      
      // What
      action,
      targetCollection,
      targetId,
      
      // Details (redacted)
      details: redactedDetails,
      
      // When
      timestamp: serverTimestamp(),
      
      // Metadata
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "server",
    };
    
    const docRef = await addDoc(collection(db, "audit_logs"), logEntry);
    
    // Also log to console for debugging
    console.log(`[AuditLog] ${action} on ${targetCollection}/${targetId}`, redactedDetails);
    
    return docRef.id;
  } catch (err) {
    // Audit logging should never break the app - just warn
    console.warn("[AuditLog] Failed to create audit log:", err);
    return null;
  }
}

/**
 * Helper function to create audit log for order actions
 */
export function logOrderAction(action, orderId, details = {}) {
  return createAuditLog(action, "orders", orderId, details);
}

/**
 * Helper function to create audit log for cost actions
 */
export function logCostAction(action, costId, details = {}) {
  return createAuditLog(action, "costs", costId, details);
}

/**
 * Helper function to create audit log for pending actions
 */
export function logPendingAction(action, pendingId, details = {}) {
  return createAuditLog(action, "pending_changes", pendingId, details);
}

/**
 * Helper function to create audit log for column actions
 */
export function logColumnAction(action, columnKey, details = {}) {
  return createAuditLog(action, "column_definitions", columnKey, details);
}

/**
 * Helper function to create audit log for auth actions
 */
export function logAuthAction(action, details = {}) {
  return createAuditLog(action, "auth", "session", details);
}
