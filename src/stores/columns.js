import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  setDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuthStore } from "@/stores/auth";

export const useColumnsStore = defineStore("columns", () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const definitions = ref([]); // ColumnDefinition[]
  const permissions = ref({}); // Map<role, RolePermission>
  const loading = ref(false);
  const error = ref(null);

  let unsubscribeColumns = null;
  let unsubscribePermissions = null;

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Returns column definitions visible to the given role,
   * based on role_permissions. Used to render spreadsheet columns.
   * System fields (systemField: true) are always visible to all roles.
   */
  const visibleColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role];
    if (!rolePerms) return [];
    return definitions.value.filter((col) => {
      // System fields are always visible
      if (col.systemField === true) {
        return true;
      }
      // Non-system fields require permission
      const perm = rolePerms.permissions?.[col.key];
      return perm?.visible === true;
    });
  });

  /**
   * Returns column definitions editable by the given role.
   */
  const editableColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role];
    if (!rolePerms) return [];
    return definitions.value.filter((col) => {
      const perm = rolePerms.permissions?.[col.key];
      return perm?.editable === true;
    });
  });

  /**
   * Returns column definitions that require approval for the given role.
   */
  const approvalColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role];
    if (!rolePerms) return [];
    return definitions.value.filter((col) => {
      const perm = rolePerms.permissions?.[col.key];
      return perm?.requiresApproval === true;
    });
  });

  /**
   * Returns a permission entry for a specific role and column key.
   */
  const getPermission = computed(() => (role, columnKey) => {
    return (
      permissions.value[role]?.permissions?.[columnKey] ?? {
        visible: false,
        editable: false,
        requiresApproval: false,
      }
    );
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function handleError(err) {
    console.error("[columns]", err);
    if (err.code === "permission-denied") {
      error.value = "You do not have permission to manage columns.";
    } else {
      error.value = err.message || "An unexpected error occurred.";
    }
  }

  function convertTimestamps(data) {
    const result = { ...data };
    const tsFields = ["createdAt", "updatedAt"];
    for (const field of tsFields) {
      if (result[field]?.toDate) result[field] = result[field].toDate();
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to real-time updates for column definitions and role permissions.
   * Both collections are needed to render the spreadsheet correctly.
   */
  function fetchColumns() {
    loading.value = true;
    error.value = null;

    // Listen to column_definitions
    const colQuery = query(
      collection(db, "column_definitions"),
      orderBy("order", "asc"),
    );

    unsubscribeColumns = onSnapshot(
      colQuery,
      (snapshot) => {
        const cols = [];
        snapshot.forEach((docSnap) => {
          cols.push({ key: docSnap.id, ...convertTimestamps(docSnap.data()) });
        });
        definitions.value = cols;
        loading.value = false;
      },
      (err) => {
        handleError(err);
        loading.value = false;
      },
    );

    // Listen to role_permissions
    unsubscribePermissions = onSnapshot(
      collection(db, "role_permissions"),
      (snapshot) => {
        const perms = {};
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          perms[docSnap.id] = {
            role: docSnap.id,
            ...data,
            updatedAt: data.updatedAt?.toDate?.() ?? null,
          };
        });
        permissions.value = perms;
      },
      (err) => {
        handleError(err);
      },
    );
  }

  /**
   * Update a column definition. Super Admin only (enforced by Firestore rules).
   * T-DATA-005: Type changes on isDataRelated columns are blocked server-side.
   * Changes to label/order on isDataRelated=false columns are always allowed.
   */
  async function updateColumn(key, changes) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can update column definitions.";
      throw new Error(error.value);
    }

    const column = definitions.value.find((c) => c.key === key);
    if (!column) {
      error.value = "Column not found.";
      return;
    }

    // Client-side guard for T-DATA-005: block type change on data-related columns
    // Firestore rules enforce this as well, but we provide early feedback here.
    if (column.isDataRelated && changes.type && changes.type !== column.type) {
      error.value =
        "Cannot change the type of a data-related column when data exists. " +
        "Set isDataRelated=false first, or ensure no order data exists for this column.";
      throw new Error(error.value);
    }

    // Optimistic update
    const idx = definitions.value.findIndex((c) => c.key === key);
    const previous = { ...definitions.value[idx] };
    definitions.value[idx] = { ...previous, ...changes };

    try {
      await updateDoc(doc(db, "column_definitions", key), {
        ...changes,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      // Revert
      definitions.value[idx] = previous;
      handleError(err);
      throw err;
    }
  }

  /**
   * Update role permissions for a specific role.
   * Super Admin only; 2nd approval enforced via Cloud Function (T-AUTHZ-004).
   */
  async function updateRolePermissions(role, newPermissions) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can update role permissions.";
      throw new Error(error.value);
    }

    const previous = permissions.value[role]
      ? { ...permissions.value[role] }
      : null;

    // Optimistic update
    permissions.value[role] = {
      ...permissions.value[role],
      permissions: newPermissions,
    };

    try {
      await updateDoc(doc(db, "role_permissions", role), {
        permissions: newPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: authStore.user.uid,
      });
    } catch (err) {
      if (previous) permissions.value[role] = previous;
      handleError(err);
      throw err;
    }
  }

  /**
   * Create a new column definition. Super Admin only.
   * T-DOS-003: Hard limit of 100 columns enforced by Firestore rules.
   * Also sets role permissions for the new column.
   *
   * @param {Object} params
   * @param {string} params.key - Column key
   * @param {string} params.label - Column label
   * @param {string} params.type - Column type (text, number, date, select)
   * @param {number} params.order - Column order
   * @param {boolean} params.isDataRelated - Whether column is data-related
   * @param {Array} params.options - Options for select type
   * @param {Object} params.rolePermissions - Permissions per role
   *   e.g. { jr_sales: { visible: true, editable: true, requiresApproval: true }, ... }
   */
  async function createColumn({
    key,
    label,
    type,
    order,
    isDataRelated = true,
    options = null,
    rolePermissions = {},
  }) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can create column definitions.";
      throw new Error(error.value);
    }

    // Validate key format
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(key)) {
      error.value =
        "Column key must start with a letter and contain only lowercase letters, numbers, and underscores.";
      throw new Error(error.value);
    }

    // Check for duplicate key
    if (definitions.value.some((c) => c.key === key)) {
      error.value = `Column with key "${key}" already exists.`;
      throw new Error(error.value);
    }

    // T-DOS-003: Check column limit
    if (definitions.value.length >= 100) {
      error.value = "Maximum of 100 columns allowed.";
      throw new Error(error.value);
    }

    const columnData = {
      key,
      label,
      type,
      order: order ?? definitions.value.length + 1,
      isDataRelated,
      systemField: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Add options for select type
    if (type === "select" && options) {
      columnData.options = options;
    }

    try {
      // Create column definition
      await setDoc(doc(db, "column_definitions", key), columnData);

      // Update role_permissions for each role
      const roleUpdates = Object.entries(rolePermissions).map(
        ([role, perms]) => {
          const currentPerms = permissions.value[role]?.permissions || {};
          return updateDoc(doc(db, "role_permissions", role), {
            [`permissions.${key}`]: {
              visible: perms.visible ?? false,
              editable: perms.editable ?? false,
              requiresApproval: perms.requiresApproval ?? false,
            },
            updatedAt: serverTimestamp(),
            updatedBy: authStore.user.uid,
          });
        },
      );

      await Promise.all(roleUpdates);

      return key;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  /**
   * Count how many orders have data in a specific column.
   * Used to show impact before editing/deleting columns.
   */
  async function getColumnDataCount(columnKey) {
    try {
      // Query orders where dynamic_fields has this key with a non-null value
      // Note: Firestore doesn't support querying for field existence directly,
      // so we fetch all orders and count client-side
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      let count = 0;
      ordersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const value = data.dynamic_fields?.[columnKey];
        if (value !== null && value !== undefined && value !== "") {
          count++;
        }
      });

      // Also check costs collection
      const costsSnapshot = await getDocs(collection(db, "costs"));
      costsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const value = data.dynamic_fields?.[columnKey];
        if (value !== null && value !== undefined && value !== "") {
          count++;
        }
      });

      return count;
    } catch (err) {
      console.error("[columns] Error counting column data:", err);
      return 0;
    }
  }

  /**
   * Clear all data from a specific column across all orders and costs.
   * This is a destructive operation and cannot be undone.
   * Super Admin only.
   */
  async function clearColumnData(columnKey) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can clear column data.";
      throw new Error(error.value);
    }

    try {
      const updates = [];

      // Clear from orders collection
      const ordersSnapshot = await getDocs(collection(db, "orders"));
      ordersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.dynamic_fields?.[columnKey] !== undefined) {
          updates.push(
            updateDoc(doc(db, "orders", docSnap.id), {
              [`dynamic_fields.${columnKey}`]: null,
              version: data.version + 1,
              updatedAt: serverTimestamp(),
            }),
          );
        }
      });

      // Clear from costs collection
      const costsSnapshot = await getDocs(collection(db, "costs"));
      costsSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.dynamic_fields?.[columnKey] !== undefined) {
          updates.push(
            updateDoc(doc(db, "costs", docSnap.id), {
              [`dynamic_fields.${columnKey}`]: null,
              version: data.version + 1,
              updatedAt: serverTimestamp(),
            }),
          );
        }
      });

      // Execute all updates
      const results = await Promise.allSettled(updates);
      const failures = results.filter((r) => r.status === "rejected");

      if (failures.length > 0) {
        console.error("[columns] Some data clearing failed:", failures);
        error.value = `${failures.length} record(s) failed to clear. Please try again.`;
        throw new Error(error.value);
      }

      return updates.length;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  /**
   * Delete a column definition. Super Admin only.
   * Cannot delete system fields.
   * Cannot delete columns with existing data - must clear data first.
   * Also removes the column from role_permissions for all roles.
   */
  async function deleteColumn(key) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can delete column definitions.";
      throw new Error(error.value);
    }

    const column = definitions.value.find((c) => c.key === key);
    if (!column) {
      error.value = "Column not found.";
      throw new Error(error.value);
    }

    if (column.systemField) {
      error.value = "Cannot delete system fields.";
      throw new Error(error.value);
    }

    // Check if data exists
    const dataCount = await getColumnDataCount(key);
    if (dataCount > 0) {
      error.value = `Cannot delete column "${key}". ${dataCount} records contain data in this column. Clear the data first.`;
      throw new Error(error.value);
    }

    try {
      // Delete column definition
      await deleteDoc(doc(db, "column_definitions", key));

      // Remove column from all role_permissions
      const rolePermissionUpdates = Object.keys(permissions.value).map((role) =>
        updateDoc(doc(db, "role_permissions", role), {
          [`permissions.${key}`]: deleteField(),
          updatedAt: serverTimestamp(),
          updatedBy: authStore.user.uid,
        }),
      );

      await Promise.allSettled(rolePermissionUpdates);
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  /**
   * Update column order (for drag-and-drop reordering).
   * Updates all affected columns in batch using Promise.allSettled
   * to handle partial failures gracefully.
   */
  async function updateColumnOrder(orderedKeys) {
    const authStore = useAuthStore();
    error.value = null;

    if (authStore.userRole !== "super_admin") {
      error.value = "Only Super Admins can reorder columns.";
      throw new Error(error.value);
    }

    try {
      // Update each column's order using allSettled to avoid partial failure issues
      const updates = orderedKeys.map((key, index) =>
        updateDoc(doc(db, "column_definitions", key), {
          order: index + 1,
          updatedAt: serverTimestamp(),
        }),
      );

      const results = await Promise.allSettled(updates);

      // Check for any failures
      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error("[columns] Some column order updates failed:", failures);
        // Show error but don't throw - the real-time listener will sync the actual state
        if (failures[0].reason?.code === "permission-denied") {
          error.value =
            "Permission denied. Some columns may not have been updated.";
        } else {
          error.value = `${failures.length} column(s) failed to update order.`;
        }
      }
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  /**
   * Stop all real-time listeners and clear state.
   */
  function cleanup() {
    if (unsubscribeColumns) {
      unsubscribeColumns();
      unsubscribeColumns = null;
    }
    if (unsubscribePermissions) {
      unsubscribePermissions();
      unsubscribePermissions = null;
    }
    definitions.value = [];
    permissions.value = {};
    loading.value = false;
    error.value = null;
  }

  return {
    // State
    definitions,
    permissions,
    loading,
    error,
    // Getters
    visibleColumns,
    editableColumns,
    approvalColumns,
    getPermission,
    // Actions
    fetchColumns,
    createColumn,
    updateColumn,
    deleteColumn,
    clearColumnData,
    getColumnDataCount,
    updateColumnOrder,
    updateRolePermissions,
    cleanup,
  };
});
