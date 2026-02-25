import { defineStore } from "pinia";
import { ref, computed } from "vue";
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
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuthStore } from "@/stores/auth";

export const useOrdersStore = defineStore("orders", () => {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const orders = ref({}); // Record<orderId, Order> — plain object for Vue reactivity
  const currentMonth = ref(""); // YYYY-MM
  const loading = ref(false);
  const error = ref(null);

  let unsubscribeListener = null;

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  // All non-deleted orders for current month
  const activeOrders = computed(() => {
    return Object.values(orders.value).filter(
      (o) => !o.deletedAt && o.month === currentMonth.value,
    );
  });

  // Soft-deleted orders for current month (visible to Manager+ for recovery)
  const deletedOrders = computed(() => {
    return Object.values(orders.value).filter(
      (o) => !!o.deletedAt && o.month === currentMonth.value,
    );
  });

  // Orders grouped by month key
  const ordersByMonth = computed(() => {
    const grouped = {};
    for (const order of Object.values(orders.value)) {
      if (!grouped[order.month]) grouped[order.month] = [];
      grouped[order.month].push(order);
    }
    return grouped;
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  async function addAuditLog(action, targetId, details = {}) {
    const authStore = useAuthStore();
    try {
      await addDoc(collection(db, "audit_logs"), {
        userId: authStore.user.uid,
        userName: authStore.user.displayName || authStore.userEmail || "",
        action,
        targetCollection: "orders",
        targetId,
        details,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn("[orders] audit log failed:", err);
    }
  }

  function convertTimestamps(data) {
    const result = { ...data };
    const tsFields = ["createdAt", "updatedAt", "deletedAt"];
    for (const field of tsFields) {
      if (result[field]?.toDate) result[field] = result[field].toDate();
      else if (result[field] === undefined) result[field] = null;
    }
    return result;
  }

  function handleError(err) {
    console.error("[orders]", err);
    if (err.code === "permission-denied") {
      error.value = "You do not have permission to perform this action.";
    } else if (err.code === "not-found") {
      error.value = "Order not found.";
    } else {
      error.value = err.message || "An unexpected error occurred.";
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to real-time updates for a given month.
   * Unsubscribes from any previous listener first.
   */
  function fetchOrders(month) {
    // Stop previous listener
    if (unsubscribeListener) {
      unsubscribeListener();
      unsubscribeListener = null;
    }

    currentMonth.value = month;
    loading.value = true;
    error.value = null;
    orders.value = new Map();

    const q = query(
      collection(db, "orders"),
      where("month", "==", month),
      orderBy("createdAt", "desc"),
    );

    unsubscribeListener = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            orders.value[change.doc.id] = {
              id: change.doc.id,
              ...convertTimestamps(change.doc.data()),
            };
          } else if (change.type === "removed") {
            delete orders.value[change.doc.id];
          }
        });
        loading.value = false;
      },
      (err) => {
        handleError(err);
        loading.value = false;
      },
    );
  }

  /**
   * Create a new order for the current month.
   */
  async function createOrder(orderData) {
    const authStore = useAuthStore();
    error.value = null;

    try {
      const docRef = await addDoc(collection(db, "orders"), {
        ...orderData,
        month: currentMonth.value,
        status: orderData.status ?? "active",
        version: 1,
        createdBy: authStore.user.uid,
        createdByName: authStore.user.displayName || authStore.userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        deletedAt: null,
        deletedBy: null,
      });
      await addAuditLog("create", docRef.id, { month: currentMonth.value });
      return docRef.id;
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  /**
   * Update a single dynamic field on an order with optimistic locking.
   * T-DATA-001: version must match current; incremented by 1 on write.
   * Reverts the local optimistic update on failure.
   */
  async function updateOrder(orderId, field, value, version) {
    error.value = null;
    const order = orders.value[orderId];
    if (!order) {
      error.value = "Order not found.";
      return;
    }

    // Optimistic update
    const previous = { ...order };
    orders.value[orderId] = {
      ...order,
      dynamic_fields: { ...order.dynamic_fields, [field]: value },
      version: version + 1,
    };

    try {
      await runTransaction(db, async (tx) => {
        const orderRef = doc(db, "orders", orderId);
        const snap = await tx.get(orderRef);

        if (!snap.exists())
          throw { code: "not-found", message: "Order not found." };

        const serverVersion = snap.data().version;
        if (serverVersion !== version) {
          throw {
            code: "version_conflict",
            message: `Version conflict: expected ${version}, got ${serverVersion}.`,
            serverVersion,
          };
        }

        if (snap.data().status === "completed") {
          throw {
            code: "completed_order",
            message: "Cannot edit a completed order.",
          };
        }

        tx.update(orderRef, {
          [`dynamic_fields.${field}`]: value,
          version: version + 1,
          updatedAt: serverTimestamp(),
        });
      });
      await addAuditLog("update", orderId, {
        field,
        newValue: value,
        version: version + 1,
      });
    } catch (err) {
      // Revert optimistic update
      orders.value[orderId] = previous;
      handleError(err);
      throw err;
    }
  }

  /**
   * Soft-delete an order by setting deletedAt (T-DATA-009).
   * Hard delete is not permitted from the client.
   */
  async function softDeleteOrder(orderId) {
    const authStore = useAuthStore();
    error.value = null;
    const order = orders.value[orderId];
    if (!order) {
      error.value = "Order not found.";
      return;
    }

    const previous = { ...order };
    const now = new Date();
    orders.value[orderId] = { ...order, deletedAt: now };

    try {
      await runTransaction(db, async (tx) => {
        const orderRef = doc(db, "orders", orderId);
        const snap = await tx.get(orderRef);
        if (!snap.exists())
          throw { code: "not-found", message: "Order not found." };

        tx.update(orderRef, {
          deletedAt: serverTimestamp(),
          deletedBy: authStore.user.uid,
          version: snap.data().version + 1,
          updatedAt: serverTimestamp(),
        });
      });
      await addAuditLog("delete", orderId, { month: order.month });
    } catch (err) {
      orders.value[orderId] = previous;
      handleError(err);
      throw err;
    }
  }

  /**
   * Recover a soft-deleted order by clearing deletedAt (T-DATA-009).
   * Only Manager+ can recover (enforced by Firestore rules).
   */
  async function recoverOrder(orderId) {
    error.value = null;
    const order = orders.value[orderId];
    if (!order) {
      error.value = "Order not found.";
      return;
    }

    const previous = { ...order };
    orders.value[orderId] = { ...order, deletedAt: null, deletedBy: null };

    try {
      await runTransaction(db, async (tx) => {
        const orderRef = doc(db, "orders", orderId);
        const snap = await tx.get(orderRef);
        if (!snap.exists())
          throw { code: "not-found", message: "Order not found." };

        tx.update(orderRef, {
          deletedAt: null,
          deletedBy: null,
          version: snap.data().version + 1,
          updatedAt: serverTimestamp(),
        });
      });
      await addAuditLog("recover", orderId, { month: order.month });
    } catch (err) {
      orders.value[orderId] = previous;
      handleError(err);
      throw err;
    }
  }

  /**
   * Stop the real-time listener and clear state.
   */
  function cleanup() {
    if (unsubscribeListener) {
      unsubscribeListener();
      unsubscribeListener = null;
    }
    orders.value = new Map();
    loading.value = false;
    error.value = null;
  }

  return {
    // State
    orders,
    currentMonth,
    loading,
    error,
    // Getters
    activeOrders,
    deletedOrders,
    ordersByMonth,
    // Actions
    fetchOrders,
    createOrder,
    updateOrder,
    softDeleteOrder,
    recoverOrder,
    cleanup,
  };
});
