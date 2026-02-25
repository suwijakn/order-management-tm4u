import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuthStore } from '@/stores/auth'

export const useColumnsStore = defineStore('columns', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const definitions = ref([])         // ColumnDefinition[]
  const permissions = ref({})         // Map<role, RolePermission>
  const loading = ref(false)
  const error = ref(null)

  let unsubscribeColumns = null
  let unsubscribePermissions = null

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Returns column definitions visible to the given role,
   * based on role_permissions. Used to render spreadsheet columns.
   */
  const visibleColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role]
    if (!rolePerms) return []
    return definitions.value.filter((col) => {
      const perm = rolePerms.permissions?.[col.key]
      return perm?.visible === true
    })
  })

  /**
   * Returns column definitions editable by the given role.
   */
  const editableColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role]
    if (!rolePerms) return []
    return definitions.value.filter((col) => {
      const perm = rolePerms.permissions?.[col.key]
      return perm?.editable === true
    })
  })

  /**
   * Returns column definitions that require approval for the given role.
   */
  const approvalColumns = computed(() => (role) => {
    const rolePerms = permissions.value[role]
    if (!rolePerms) return []
    return definitions.value.filter((col) => {
      const perm = rolePerms.permissions?.[col.key]
      return perm?.requiresApproval === true
    })
  })

  /**
   * Returns a permission entry for a specific role and column key.
   */
  const getPermission = computed(() => (role, columnKey) => {
    return permissions.value[role]?.permissions?.[columnKey] ?? {
      visible: false,
      editable: false,
      requiresApproval: false,
    }
  })

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function handleError(err) {
    console.error('[columns]', err)
    if (err.code === 'permission-denied') {
      error.value = 'You do not have permission to manage columns.'
    } else {
      error.value = err.message || 'An unexpected error occurred.'
    }
  }

  function convertTimestamps(data) {
    const result = { ...data }
    const tsFields = ['createdAt', 'updatedAt']
    for (const field of tsFields) {
      if (result[field]?.toDate) result[field] = result[field].toDate()
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to real-time updates for column definitions and role permissions.
   * Both collections are needed to render the spreadsheet correctly.
   */
  function fetchColumns() {
    loading.value = true
    error.value = null

    // Listen to column_definitions
    const colQuery = query(
      collection(db, 'column_definitions'),
      orderBy('order', 'asc')
    )

    unsubscribeColumns = onSnapshot(
      colQuery,
      (snapshot) => {
        const cols = []
        snapshot.forEach((docSnap) => {
          cols.push({ key: docSnap.id, ...convertTimestamps(docSnap.data()) })
        })
        definitions.value = cols
        loading.value = false
      },
      (err) => {
        handleError(err)
        loading.value = false
      }
    )

    // Listen to role_permissions
    unsubscribePermissions = onSnapshot(
      collection(db, 'role_permissions'),
      (snapshot) => {
        const perms = {}
        snapshot.forEach((docSnap) => {
          const data = docSnap.data()
          perms[docSnap.id] = {
            role: docSnap.id,
            ...data,
            updatedAt: data.updatedAt?.toDate?.() ?? null,
          }
        })
        permissions.value = perms
      },
      (err) => {
        handleError(err)
      }
    )
  }

  /**
   * Update a column definition. Super Admin only (enforced by Firestore rules).
   * T-DATA-005: Type changes on isDataRelated columns are blocked server-side.
   * Changes to label/order on isDataRelated=false columns are always allowed.
   */
  async function updateColumn(key, changes) {
    const authStore = useAuthStore()
    error.value = null

    if (authStore.userRole !== 'super_admin') {
      error.value = 'Only Super Admins can update column definitions.'
      throw new Error(error.value)
    }

    const column = definitions.value.find((c) => c.key === key)
    if (!column) {
      error.value = 'Column not found.'
      return
    }

    // Client-side guard for T-DATA-005: block type change on data-related columns
    // Firestore rules enforce this as well, but we provide early feedback here.
    if (column.isDataRelated && changes.type && changes.type !== column.type) {
      error.value =
        'Cannot change the type of a data-related column when data exists. ' +
        'Set isDataRelated=false first, or ensure no order data exists for this column.'
      throw new Error(error.value)
    }

    // Optimistic update
    const idx = definitions.value.findIndex((c) => c.key === key)
    const previous = { ...definitions.value[idx] }
    definitions.value[idx] = { ...previous, ...changes }

    try {
      await updateDoc(doc(db, 'column_definitions', key), {
        ...changes,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      // Revert
      definitions.value[idx] = previous
      handleError(err)
      throw err
    }
  }

  /**
   * Update role permissions for a specific role.
   * Super Admin only; 2nd approval enforced via Cloud Function (T-AUTHZ-004).
   */
  async function updateRolePermissions(role, newPermissions) {
    const authStore = useAuthStore()
    error.value = null

    if (authStore.userRole !== 'super_admin') {
      error.value = 'Only Super Admins can update role permissions.'
      throw new Error(error.value)
    }

    const previous = permissions.value[role] ? { ...permissions.value[role] } : null

    // Optimistic update
    permissions.value[role] = {
      ...permissions.value[role],
      permissions: newPermissions,
    }

    try {
      await updateDoc(doc(db, 'role_permissions', role), {
        permissions: newPermissions,
        updatedAt: serverTimestamp(),
        updatedBy: authStore.user.uid,
      })
    } catch (err) {
      if (previous) permissions.value[role] = previous
      handleError(err)
      throw err
    }
  }

  /**
   * Stop all real-time listeners and clear state.
   */
  function cleanup() {
    if (unsubscribeColumns) {
      unsubscribeColumns()
      unsubscribeColumns = null
    }
    if (unsubscribePermissions) {
      unsubscribePermissions()
      unsubscribePermissions = null
    }
    definitions.value = []
    permissions.value = {}
    loading.value = false
    error.value = null
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
    updateColumn,
    updateRolePermissions,
    cleanup,
  }
})
