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
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuthStore } from '@/stores/auth'

// 7-day expiry for pending changes (T-DATA-003)
const PENDING_EXPIRY_DAYS = 7

export const usePendingsStore = defineStore('pendings', () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const pendings = ref([])            // PendingChange[]
  const loading = ref(false)
  const error = ref(null)

  let unsubscribeListener = null

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  // Unread/pending count for badge notifications
  const unreadCount = computed(() =>
    pendings.value.filter((p) => p.status === 'pending').length
  )

  // Only pending (not yet reviewed)
  const pendingItems = computed(() =>
    pendings.value.filter((p) => p.status === 'pending')
  )

  // Resolved (approved, rejected, withdrawn)
  const resolvedItems = computed(() =>
    pendings.value.filter((p) => p.status !== 'pending')
  )

  // Pendings for a specific target (order or cost)
  const pendingsForTarget = computed(() => (targetId) =>
    pendings.value.filter((p) => p.targetId === targetId)
  )

  // Pendings for a specific target + field combination
  const pendingForField = computed(() => (targetId, field) =>
    pendings.value.find(
      (p) => p.targetId === targetId && p.field === field && p.status === 'pending'
    ) ?? null
  )

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function handleError(err) {
    console.error('[pendings]', err)
    if (err.code === 'permission-denied') {
      error.value = 'You do not have permission to perform this action.'
    } else if (err.code === 'already-exists') {
      error.value = 'A pending change already exists for this field.'
    } else {
      error.value = err.message || 'An unexpected error occurred.'
    }
  }

  function convertTimestamps(data) {
    const result = { ...data }
    const tsFields = ['requestedAt', 'statusUpdatedAt', 'expiresAt']
    for (const field of tsFields) {
      if (result[field]?.toDate) result[field] = result[field].toDate()
      else if (result[field] === undefined) result[field] = null
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to real-time pending changes.
   * - Managers see all pending changes
   * - Other roles see only their own pending changes
   */
  function fetchPendings(filterByUser = false) {
    if (unsubscribeListener) {
      unsubscribeListener()
      unsubscribeListener = null
    }

    const authStore = useAuthStore()
    loading.value = true
    error.value = null

    let q
    if (filterByUser || !['manager', 'super_admin'].includes(authStore.userRole)) {
      // Non-managers only see their own
      q = query(
        collection(db, 'pending_changes'),
        where('requestedBy', '==', authStore.user.uid),
        orderBy('requestedAt', 'desc')
      )
    } else {
      // Managers and Super Admins see all pending changes
      q = query(
        collection(db, 'pending_changes'),
        orderBy('requestedAt', 'desc')
      )
    }

    unsubscribeListener = onSnapshot(
      q,
      (snapshot) => {
        const items = []
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...convertTimestamps(docSnap.data()) })
        })
        pendings.value = items
        loading.value = false
      },
      (err) => {
        handleError(err)
        loading.value = false
      }
    )
  }

  /**
   * Create a new pending change request.
   * T-DATA-002: Uniqueness (targetId + field + status=pending) is enforced
   * by Firestore rules and Cloud Function. Client checks for early feedback.
   * T-DOS-002: Rate limiting enforced by Cloud Function.
   */
  async function createPending({ targetCollection, targetId, orderMonth, field, baseValue, baseVersion, newValue }) {
    const authStore = useAuthStore()
    error.value = null

    // Client-side uniqueness check for early feedback (T-DATA-002)
    const existing = pendingForField.value(targetId, field)
    if (existing) {
      error.value = `A pending change already exists for field "${field}" on this record.`
      throw new Error(error.value)
    }

    // Cost pendings require Manager+ (T-AUTHZ-005)
    if (targetCollection === 'costs' && !['manager', 'super_admin'].includes(authStore.userRole)) {
      error.value = 'Only Managers and Super Admins can create pending changes for cost entries.'
      throw new Error(error.value)
    }

    const expiresAt = Timestamp.fromDate(
      new Date(Date.now() + PENDING_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    )

    try {
      const docRef = await addDoc(collection(db, 'pending_changes'), {
        targetCollection,
        targetId,
        orderId: targetCollection === 'orders' ? targetId : null,
        orderMonth,
        field,
        baseValue,
        baseVersion,
        newValue,
        requestedBy: authStore.user.uid,
        requestedByName: authStore.user.displayName || authStore.userEmail,
        requestedAt: serverTimestamp(),
        status: 'pending',
        statusUpdatedAt: null,
        reviewedBy: null,
        rejectionCount: 0,
        expiresAt,
      })
      return docRef.id
    } catch (err) {
      handleError(err)
      throw err
    }
  }

  /**
   * Approve a pending change. Manager+ only.
   * The actual field update on the order/cost is handled by a Cloud Function
   * that runs the approval transaction atomically (verifies baseVersion, etc.)
   */
  async function approvePending(pendingId) {
    const authStore = useAuthStore()
    error.value = null

    if (!['manager', 'super_admin'].includes(authStore.userRole)) {
      error.value = 'Only Managers and Super Admins can approve pending changes.'
      throw new Error(error.value)
    }

    // Optimistic update
    const idx = pendings.value.findIndex((p) => p.id === pendingId)
    const previous = idx >= 0 ? { ...pendings.value[idx] } : null
    if (idx >= 0) {
      pendings.value[idx] = {
        ...pendings.value[idx],
        status: 'approved',
        reviewedBy: authStore.user.uid,
        statusUpdatedAt: new Date(),
      }
    }

    try {
      await updateDoc(doc(db, 'pending_changes', pendingId), {
        status: 'approved',
        reviewedBy: authStore.user.uid,
        statusUpdatedAt: serverTimestamp(),
      })
    } catch (err) {
      if (idx >= 0 && previous) pendings.value[idx] = previous
      handleError(err)
      throw err
    }
  }

  /**
   * Reject a pending change. Manager+ only.
   * Increments rejectionCount. T-LOGIC-003: cooldown after rejection
   * is enforced by Cloud Function.
   */
  async function rejectPending(pendingId) {
    const authStore = useAuthStore()
    error.value = null

    if (!['manager', 'super_admin'].includes(authStore.userRole)) {
      error.value = 'Only Managers and Super Admins can reject pending changes.'
      throw new Error(error.value)
    }

    const idx = pendings.value.findIndex((p) => p.id === pendingId)
    const previous = idx >= 0 ? { ...pendings.value[idx] } : null
    const currentRejectionCount = pendings.value[idx]?.rejectionCount ?? 0

    if (idx >= 0) {
      pendings.value[idx] = {
        ...pendings.value[idx],
        status: 'rejected',
        reviewedBy: authStore.user.uid,
        statusUpdatedAt: new Date(),
        rejectionCount: currentRejectionCount + 1,
      }
    }

    try {
      await updateDoc(doc(db, 'pending_changes', pendingId), {
        status: 'rejected',
        reviewedBy: authStore.user.uid,
        statusUpdatedAt: serverTimestamp(),
        rejectionCount: currentRejectionCount + 1,
      })
    } catch (err) {
      if (idx >= 0 && previous) pendings.value[idx] = previous
      handleError(err)
      throw err
    }
  }

  /**
   * Withdraw a pending change. Only the requester can withdraw their own.
   */
  async function withdrawPending(pendingId) {
    const authStore = useAuthStore()
    error.value = null

    const pending = pendings.value.find((p) => p.id === pendingId)
    if (!pending) {
      error.value = 'Pending change not found.'
      throw new Error(error.value)
    }

    if (pending.requestedBy !== authStore.user.uid) {
      error.value = 'You can only withdraw your own pending changes.'
      throw new Error(error.value)
    }

    if (pending.status !== 'pending') {
      error.value = 'Only pending changes can be withdrawn.'
      throw new Error(error.value)
    }

    const idx = pendings.value.findIndex((p) => p.id === pendingId)
    const previous = { ...pendings.value[idx] }
    pendings.value[idx] = {
      ...pendings.value[idx],
      status: 'withdrawn',
      statusUpdatedAt: new Date(),
    }

    try {
      await updateDoc(doc(db, 'pending_changes', pendingId), {
        status: 'withdrawn',
        statusUpdatedAt: serverTimestamp(),
      })
    } catch (err) {
      pendings.value[idx] = previous
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
    pendings.value = []
    loading.value = false
    error.value = null
  }

  return {
    // State
    pendings,
    loading,
    error,
    // Getters
    unreadCount,
    pendingItems,
    resolvedItems,
    pendingsForTarget,
    pendingForField,
    // Actions
    fetchPendings,
    createPending,
    approvePending,
    rejectPending,
    withdrawPending,
    cleanup,
  }
})
