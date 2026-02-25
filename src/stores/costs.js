import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuthStore } from '@/stores/auth'

export const useCostsStore = defineStore('costs', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const costs = ref(new Map())        // Map<costId, Cost>
  const currentMonth = ref('')        // YYYY-MM
  const loading = ref(false)
  const error = ref(null)

  let unsubscribeListener = null

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  // Active (non-deleted) costs for current month
  const activeCosts = computed(() => {
    return Array.from(costs.value.values()).filter(
      (c) => !c.deletedAt && c.month === currentMonth.value
    )
  })

  // Soft-deleted costs (visible to Manager+ for recovery)
  const deletedCosts = computed(() => {
    return Array.from(costs.value.values()).filter(
      (c) => !!c.deletedAt && c.month === currentMonth.value
    )
  })

  // Costs grouped by month key
  const costsByMonth = computed(() => {
    const grouped = {}
    for (const cost of costs.value.values()) {
      if (!grouped[cost.month]) grouped[cost.month] = []
      grouped[cost.month].push(cost)
    }
    return grouped
  })

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function isAuthorized() {
    const authStore = useAuthStore()
    // T-AUTHZ-005: Cost data restricted to Manager and Super Admin only
    return ['manager', 'super_admin'].includes(authStore.user?.role ?? '')
  }

  function convertTimestamps(data) {
    const result = { ...data }
    const tsFields = ['createdAt', 'updatedAt', 'deletedAt']
    for (const field of tsFields) {
      if (result[field]?.toDate) result[field] = result[field].toDate()
      else if (result[field] === undefined) result[field] = null
    }
    return result
  }

  function handleError(err) {
    console.error('[costs]', err)
    if (err.code === 'permission-denied') {
      error.value = 'You do not have permission to access cost data.'
    } else if (err.code === 'not-found') {
      error.value = 'Cost entry not found.'
    } else {
      error.value = err.message || 'An unexpected error occurred.'
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to real-time updates for a given month.
   * T-AUTHZ-005: Only fetches if user is Manager or Super Admin.
   * Silently skips for unauthorized roles (rules will also enforce this).
   */
  function fetchCosts(month) {
    if (!isAuthorized()) {
      // Unauthorized roles get no data — Firestore rules enforce this too,
      // but we skip the listener entirely to avoid error noise on the client.
      return
    }

    if (unsubscribeListener) {
      unsubscribeListener()
      unsubscribeListener = null
    }

    currentMonth.value = month
    loading.value = true
    error.value = null
    costs.value = new Map()

    const q = query(
      collection(db, 'costs'),
      where('month', '==', month),
      orderBy('createdAt', 'desc')
    )

    unsubscribeListener = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            costs.value.set(change.doc.id, {
              id: change.doc.id,
              ...convertTimestamps(change.doc.data()),
            })
          } else if (change.type === 'removed') {
            costs.value.delete(change.doc.id)
          }
        })
        loading.value = false
      },
      (err) => {
        handleError(err)
        loading.value = false
      }
    )
  }

  /**
   * Create a new cost entry. Manager+ only.
   */
  async function createCost(costData) {
    if (!isAuthorized()) {
      error.value = 'Only Managers and Super Admins can create cost entries.'
      throw new Error(error.value)
    }

    const authStore = useAuthStore()
    error.value = null

    try {
      const docRef = await addDoc(collection(db, 'costs'), {
        ...costData,
        month: currentMonth.value,
        status: costData.status ?? 'active',
        version: 1,
        createdBy: authStore.user.uid,
        createdByName: authStore.user.displayName || authStore.userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        deletedBy: null,
      })
      return docRef.id
    } catch (err) {
      handleError(err)
      throw err
    }
  }

  /**
   * Update a single dynamic field on a cost entry with optimistic locking.
   * T-DATA-001: version must match current; incremented by 1 on write.
   */
  async function updateCost(costId, field, value, version) {
    if (!isAuthorized()) {
      error.value = 'Only Managers and Super Admins can update cost entries.'
      throw new Error(error.value)
    }

    error.value = null
    const cost = costs.value.get(costId)
    if (!cost) {
      error.value = 'Cost entry not found.'
      return
    }

    const previous = { ...cost }
    costs.value.set(costId, {
      ...cost,
      dynamic_fields: { ...cost.dynamic_fields, [field]: value },
      version: version + 1,
    })

    try {
      await runTransaction(db, async (tx) => {
        const costRef = doc(db, 'costs', costId)
        const snap = await tx.get(costRef)

        if (!snap.exists()) throw { code: 'not-found', message: 'Cost entry not found.' }

        const serverVersion = snap.data().version
        if (serverVersion !== version) {
          throw {
            code: 'version_conflict',
            message: `Version conflict: expected ${version}, got ${serverVersion}.`,
            serverVersion,
          }
        }

        if (snap.data().status === 'completed') {
          throw { code: 'completed_order', message: 'Cannot edit a completed cost entry.' }
        }

        tx.update(costRef, {
          [`dynamic_fields.${field}`]: value,
          version: version + 1,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (err) {
      costs.value.set(costId, previous)
      handleError(err)
      throw err
    }
  }

  /**
   * Soft-delete a cost entry by setting deletedAt (T-DATA-009).
   */
  async function softDeleteCost(costId) {
    if (!isAuthorized()) {
      error.value = 'Only Managers and Super Admins can delete cost entries.'
      throw new Error(error.value)
    }

    const authStore = useAuthStore()
    error.value = null
    const cost = costs.value.get(costId)
    if (!cost) {
      error.value = 'Cost entry not found.'
      return
    }

    const previous = { ...cost }
    const now = new Date()
    costs.value.set(costId, { ...cost, deletedAt: now })

    try {
      await runTransaction(db, async (tx) => {
        const costRef = doc(db, 'costs', costId)
        const snap = await tx.get(costRef)
        if (!snap.exists()) throw { code: 'not-found', message: 'Cost entry not found.' }

        tx.update(costRef, {
          deletedAt: serverTimestamp(),
          deletedBy: authStore.user.uid,
          version: snap.data().version + 1,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (err) {
      costs.value.set(costId, previous)
      handleError(err)
      throw err
    }
  }

  /**
   * Recover a soft-deleted cost entry (T-DATA-009). Manager+ only.
   */
  async function recoverCost(costId) {
    if (!isAuthorized()) {
      error.value = 'Only Managers and Super Admins can recover cost entries.'
      throw new Error(error.value)
    }

    error.value = null
    const cost = costs.value.get(costId)
    if (!cost) {
      error.value = 'Cost entry not found.'
      return
    }

    const previous = { ...cost }
    costs.value.set(costId, { ...cost, deletedAt: null, deletedBy: null })

    try {
      await runTransaction(db, async (tx) => {
        const costRef = doc(db, 'costs', costId)
        const snap = await tx.get(costRef)
        if (!snap.exists()) throw { code: 'not-found', message: 'Cost entry not found.' }

        tx.update(costRef, {
          deletedAt: null,
          deletedBy: null,
          version: snap.data().version + 1,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (err) {
      costs.value.set(costId, previous)
      handleError(err)
      throw err
    }
  }

  /**
   * Stop the real-time listener and clear state.
   */
  function cleanup() {
    if (unsubscribeListener) {
      unsubscribeListener()
      unsubscribeListener = null
    }
    costs.value = new Map()
    loading.value = false
    error.value = null
  }

  return {
    // State
    costs,
    currentMonth,
    loading,
    error,
    // Getters
    activeCosts,
    deletedCosts,
    costsByMonth,
    // Actions
    fetchCosts,
    createCost,
    updateCost,
    softDeleteCost,
    recoverCost,
    cleanup,
  }
})
