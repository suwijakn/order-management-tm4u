<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useOrdersStore } from "@/stores/orders";
import { useAuthStore } from "@/stores/auth";
import { useColumnsStore } from "@/stores/columns";
import { useCostsStore } from "@/stores/costs";
import { usePendingsStore } from "@/stores/pendings";
import { useAuth } from "@/composables/useAuth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const columnsStore = useColumnsStore();
const costsStore = useCostsStore();
const pendingsStore = usePendingsStore();
const { currentUser: user } = useAuth();

// User role from Firestore
const userRole = ref(null);
const loadingRole = ref(false);

// Constants
const ORDER_STATUSES = ["active", "completed", "cancelled"];
const ALLOWED_ROLES = ["super_admin", "manager", "jr_sales", "sr_sales"];
const DELETE_ALLOWED_ROLES = ["super_admin", "manager"];
const DEFAULT_FIELD = "customer_name";
const TEST_VALUES = {
  first: "Another Corp",
  conflicting: "Conflicting Corp",
  final: "Final Corp",
};

// Check if user can delete orders
const canDelete = computed(() => {
  const role = authStore.userRole;
  return role && DELETE_ALLOWED_ROLES.includes(role);
});

// Form state
const formData = ref({
  month: new Date().toISOString().slice(0, 7),
  status: ORDER_STATUSES[0], // Default to first status
  dynamic_fields: {},
});

const loading = ref(false);
const error = ref(null);
const success = ref(null);

// Component initialization state
const isInitialized = ref(true); // Set to true since formData is initialized

// Get visible columns for current user role
const visibleColumns = computed(() => {
  if (!userRole.value) return [];
  const visibleFn = columnsStore.visibleColumns;
  return visibleFn ? visibleFn(userRole.value) : [];
});

// Filter out system fields (id, month, status) since they're handled separately
const dynamicColumns = computed(() => {
  return visibleColumns.value.filter((col) => !col.systemField);
});

// Fetch user role from Firestore or custom claims
async function fetchUserRole() {
  if (!user.value?.uid) return;

  loadingRole.value = true;
  try {
    // First try to get role from custom claims
    if (user.value.role) {
      userRole.value = user.value.role;
      console.log("Role from custom claims:", user.value.role);
      return;
    }

    // Fallback to Firestore user document
    const userDoc = await getDoc(doc(db, "users", user.value.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      userRole.value = userData.role || "user";
      console.log("Role from Firestore:", userRole.value);
    } else {
      console.log("No user document found in Firestore");
    }
  } catch (err) {
    console.error("Failed to fetch user role:", err);
  } finally {
    loadingRole.value = false;
  }
}

// Check if user has allowed role for dashboard access
const allowedRoles = ALLOWED_ROLES;

function checkUserRole() {
  if (user.value) {
    // ONLY check custom claims - no fallbacks
    const customClaims = user.value.customClaims || {};
    const role = customClaims.role;

    console.log("[TestOrderCreate] Role check:", {
      customClaims,
      role,
      allowedRoles,
    });

    // If no custom claims or role not in allowed list, deny access
    if (!role || !allowedRoles.includes(role)) {
      console.log(
        "[TestOrderCreate] Access denied - no valid custom claims role:",
        role,
      );
      // User doesn't have allowed role, redirect to login
      router.push({
        name: "Login",
        query: { redirect: "/test-order-create", error: "insufficient_role" },
      });
    } else {
      console.log("[TestOrderCreate] Access granted for role:", role);
    }
  }
}

// Watch for user changes and fetch role
watch(
  user,
  async (newUser) => {
    if (newUser) {
      await fetchUserRole();
      checkUserRole();
    }
  },
  { immediate: true },
);

onMounted(() => {
  columnsStore.fetchColumns();
  // Set current month in orders store with defensive check
  if (formData.value?.month) {
    ordersStore.currentMonth = formData.value.month;
    ordersStore.fetchOrders(formData.value.month);
  } else {
    // Fallback to current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    ordersStore.currentMonth = currentMonth;
    ordersStore.fetchOrders(currentMonth);
  }
});

onUnmounted(() => {
  columnsStore.cleanup();
  ordersStore.cleanup();
});

async function handleCreateOrder() {
  loading.value = true;
  error.value = null;
  success.value = null;

  try {
    // Set current month in orders store
    if (formData.value?.month) {
      ordersStore.currentMonth = formData.value.month;
    }

    // Create the order (backend should handle authorization)
    const orderId = await ordersStore.createOrder(formData.value);

    success.value = `Order created successfully! ID: ${orderId}`;

    // Reset dynamic fields only
    formData.value.dynamic_fields = {};
  } catch (err) {
    error.value = err.message || "Failed to create order";
    console.error("Create order error:", err);
  } finally {
    loading.value = false;
  }
}

// Test update order function
const updateOrderId = ref("");
const updateField = ref(DEFAULT_FIELD);
const updateValue = ref("");
const updateVersion = ref(1);

// Get current order version when order ID changes
const currentOrder = computed(() => {
  if (!updateOrderId.value) return null;
  return ordersStore.activeOrders.find(
    (order) => order.id === updateOrderId.value,
  );
});

// Auto-update version when order is selected
watch(updateOrderId, (newOrderId) => {
  if (newOrderId && currentOrder.value) {
    updateVersion.value = currentOrder.value.version || 1;
  }
});
const updateLoading = ref(false);
const updateError = ref(null);
const updateSuccess = ref(null);

async function handleUpdateOrder() {
  if (!updateOrderId.value) {
    updateError.value = "Please enter an order ID";
    return;
  }

  updateLoading.value = true;
  updateError.value = null;
  updateSuccess.value = null;

  try {
    console.log("Testing updateOrder:", {
      orderId: updateOrderId.value,
      field: updateField.value,
      value: updateValue.value,
      version: updateVersion.value,
    });

    await ordersStore.updateOrder(
      updateOrderId.value,
      updateField.value,
      updateValue.value,
      updateVersion.value,
    );
    updateSuccess.value = `Order ${updateOrderId.value} updated successfully!`;

    // Refresh orders to see the change
    if (formData.value?.month) {
      ordersStore.fetchOrders(formData.value.month);
    }
  } catch (err) {
    updateError.value = err.message || "Failed to update order";
    console.error("Update order error:", err);
  } finally {
    updateLoading.value = false;
  }
}

// Test version conflict
const conflictOrderId = ref("");
const conflictLoading = ref(false);
const conflictError = ref(null);
const conflictSuccess = ref(null);

async function handleVersionConflict() {
  if (!conflictOrderId.value) {
    conflictError.value = "Please enter an order ID";
    return;
  }

  conflictLoading.value = true;
  conflictError.value = null;
  conflictSuccess.value = null;

  try {
    console.log("Testing version conflict with order:", conflictOrderId.value);

    // First update - should succeed
    console.log(
      `Step 1: First update (${DEFAULT_FIELD} -> ${TEST_VALUES.first}, version 1)`,
    );
    await ordersStore.updateOrder(
      conflictOrderId.value,
      DEFAULT_FIELD,
      TEST_VALUES.first,
      1,
    );
    conflictSuccess.value = "First update successful! Now testing conflict...";

    // Wait a moment
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Second update with same version - should fail with conflict
    console.log("Step 2: Second update with same version (should conflict)");
    try {
      await ordersStore.updateOrder(
        conflictOrderId.value,
        DEFAULT_FIELD,
        TEST_VALUES.conflicting,
        1,
      );
      conflictSuccess.value += " ERROR: Second update should have failed!";
    } catch (conflictErr) {
      console.log("Expected conflict error:", conflictErr);
      conflictSuccess.value +=
        " Conflict detected as expected! Error: " + conflictErr.message;
    }

    // Third update with correct version - should succeed
    await new Promise((resolve) => setTimeout(resolve, 500));
    console.log("Step 3: Third update with correct version (version 2)");
    await ordersStore.updateOrder(
      conflictOrderId.value,
      DEFAULT_FIELD,
      TEST_VALUES.final,
      2,
    );
    conflictSuccess.value += " Final update successful with version 2!";

    // Refresh orders to see the final state
    if (formData.value?.month) {
      ordersStore.fetchOrders(formData.value.month);
    }
  } catch (err) {
    conflictError.value = err.message || "Failed to test version conflict";
    console.error("Version conflict test error:", err);
  } finally {
    conflictLoading.value = false;
  }
}

function updateDynamicField(key, value) {
  if (value === "") {
    delete formData.value.dynamic_fields[key];
  } else {
    formData.value.dynamic_fields[key] = value;
  }
}

function getFieldValue(key) {
  return formData.value.dynamic_fields[key] || "";
}

function addDynamicField() {
  const key = prompt("Enter field key:");
  if (key && !formData.value.dynamic_fields[key]) {
    formData.value.dynamic_fields[key] = "";
  }
}

function removeDynamicField(key) {
  delete formData.value.dynamic_fields[key];
}

// Test soft delete function
const deleteOrderId = ref("");
const deleteLoading = ref(false);
const deleteError = ref(null);
const deleteSuccess = ref(null);

async function handleSoftDelete() {
  if (!deleteOrderId.value) {
    deleteError.value = "Please enter an order ID";
    return;
  }

  deleteLoading.value = true;
  deleteError.value = null;
  deleteSuccess.value = null;

  try {
    console.log("Testing softDeleteOrder:", deleteOrderId.value);

    await ordersStore.softDeleteOrder(deleteOrderId.value);
    deleteSuccess.value = `Order ${deleteOrderId.value} soft deleted successfully!`;

    // Refresh orders to see the change
    if (formData.value?.month) {
      ordersStore.fetchOrders(formData.value.month);
    }
  } catch (err) {
    deleteError.value = err.message || "Failed to soft delete order";
    console.error("Soft delete error:", err);
  } finally {
    deleteLoading.value = false;
  }
}

// Test costs store function
const costsMonth = ref("2026-03");
const costsLoading = ref(false);
const costsError = ref(null);
const costsSuccess = ref(null);

// Check if user can access costs (Manager and Super Admin only)
const canAccessCosts = computed(() => {
  const role = authStore.userRole;
  return role && ["manager", "super_admin"].includes(role);
});

async function handleFetchCosts() {
  costsLoading.value = true;
  costsError.value = null;
  costsSuccess.value = null;

  try {
    console.log("Testing costsStore.fetchCosts:", costsMonth.value);
    console.log("User role:", authStore.userRole);
    console.log("Can access costs:", canAccessCosts.value);

    await costsStore.fetchCosts(costsMonth.value);

    // Wait a moment for the real-time listener to populate data
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const activeCosts = costsStore.activeCosts;
    const deletedCosts = costsStore.deletedCosts;
    const allCosts = costsStore.costs;

    console.log("Costs store state:", {
      currentMonth: costsStore.currentMonth,
      loading: costsStore.loading,
      error: costsStore.error,
      activeCostsCount: activeCosts.length,
      deletedCostsCount: deletedCosts.length,
      allCostsSize: allCosts.size || allCosts.length,
      allCostsData: Array.from(allCosts.values || allCosts).map((c) => ({
        id: c.id,
        month: c.month,
        amount: c.amount,
        deletedAt: c.deletedAt,
      })),
    });

    costsSuccess.value =
      `Successfully fetched costs for ${costsMonth.value}!\n` +
      `Active costs: ${activeCosts.length}\n` +
      `Deleted costs: ${deletedCosts.length}\n` +
      `Total costs: ${allCosts.size || allCosts.length}\n` +
      `Current month in store: ${costsStore.currentMonth}`;
  } catch (err) {
    costsError.value = err.message || "Failed to fetch costs";
    console.error("Costs fetch error:", err);
  } finally {
    costsLoading.value = false;
  }
}

// Test create cost function
const createCostData = ref({
  month: "2026-03",
  status: "active",
  dynamic_fields: {
    material_cost: 5000,
    labor_cost: 3000,
    overhead_cost: 2000,
  },
});

const createCostLoading = ref(false);
const createCostError = ref(null);
const createCostSuccess = ref(null);

const dynamicFieldsText = ref(
  JSON.stringify(createCostData.value.dynamic_fields, null, 2),
);

function updateDynamicFields() {
  try {
    const parsed = JSON.parse(dynamicFieldsText.value);
    createCostData.value.dynamic_fields = parsed;
  } catch (err) {
    console.warn("Invalid JSON in dynamic fields:", err);
  }
}

async function handleCreateCost() {
  createCostLoading.value = true;
  createCostError.value = null;
  createCostSuccess.value = null;

  try {
    JSON.parse(dynamicFieldsText.value);

    console.log("Testing costsStore.createCost:", createCostData.value);
    console.log("User role:", authStore.userRole);
    console.log("Can access costs:", canAccessCosts.value);

    const costId = await costsStore.createCost(createCostData.value);

    createCostSuccess.value =
      `Cost created successfully!\n` +
      `Cost ID: ${costId}\n` +
      `Month: ${createCostData.value.month}\n` +
      `Status: ${createCostData.value.status}\n` +
      `Dynamic fields: ${JSON.stringify(createCostData.value.dynamic_fields, null, 2)}`;

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await costsStore.fetchCosts(createCostData.value.month);
  } catch (err) {
    createCostError.value = err.message || "Failed to create cost";
    console.error("Cost creation error:", err);
  } finally {
    createCostLoading.value = false;
  }
}

// Test create pending function
const createPendingData = ref({
  targetCollection: "orders",
  targetId: "", // Will be filled from selected order
  field: "order_value",
  baseValue: null, // Will be fetched from Firestore
  baseVersion: null, // Will be fetched from Firestore
  newValue: 12000,
});

const createPendingLoading = ref(false);
const createPendingError = ref(null);
const createPendingSuccess = ref(null);
const fetchingTargetData = ref(false);

// Check if user can create pending changes
const canCreatePending = computed(() => {
  const role = authStore.userRole;
  return (
    role && ["super_admin", "manager", "jr_sales", "sr_sales"].includes(role)
  );
});

// Fetch current document data when targetId or field changes
async function fetchTargetData() {
  if (!createPendingData.value.targetId || !createPendingData.value.field) {
    createPendingData.value.baseValue = null;
    createPendingData.value.baseVersion = null;
    return;
  }

  fetchingTargetData.value = true;
  try {
    console.log("Fetching target data:", {
      collection: createPendingData.value.targetCollection,
      id: createPendingData.value.targetId,
      field: createPendingData.value.field,
    });

    const docRef = doc(
      db,
      createPendingData.value.targetCollection,
      createPendingData.value.targetId,
    );
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      createPendingData.value.baseVersion = data.version || 1;

      // Get the current value for the specified field
      if (createPendingData.value.field.startsWith("dynamic_fields.")) {
        const fieldName = createPendingData.value.field.replace(
          "dynamic_fields.",
          "",
        );
        createPendingData.value.baseValue =
          data.dynamic_fields?.[fieldName] || null;
      } else {
        createPendingData.value.baseValue =
          data[createPendingData.value.field] || null;
      }

      console.log("Fetched target data:", {
        baseValue: createPendingData.value.baseValue,
        baseVersion: createPendingData.value.baseVersion,
      });
    } else {
      createPendingData.value.baseValue = null;
      createPendingData.value.baseVersion = null;
      console.warn("Target document not found");
    }
  } catch (err) {
    console.error("Error fetching target data:", err);
    createPendingData.value.baseValue = null;
    createPendingData.value.baseVersion = null;
  } finally {
    fetchingTargetData.value = false;
  }
}

// Watch for changes in targetId or field
watch(
  [() => createPendingData.value.targetId, () => createPendingData.value.field],
  () => {
    fetchTargetData();
  },
);

async function handleCreatePending() {
  createPendingLoading.value = true;
  createPendingError.value = null;
  createPendingSuccess.value = null;

  try {
    console.log(
      "Testing pendingsStore.createPending:",
      createPendingData.value,
    );
    console.log("User role:", authStore.userRole);
    console.log("Can create pending:", canCreatePending.value);

    const pendingId = await pendingsStore.createPending(
      createPendingData.value,
    );

    createPendingSuccess.value =
      `Pending change created successfully!\n` +
      `Pending ID: ${pendingId}\n` +
      `Target: ${createPendingData.value.targetCollection}/${createPendingData.value.targetId}\n` +
      `Field: ${createPendingData.value.field}\n` +
      `Change: ${createPendingData.value.baseValue} → ${createPendingData.value.newValue}\n` +
      `Base Version: ${createPendingData.value.baseVersion}`;

    // Refresh pendings to see the new entry
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err) {
    createPendingError.value = err.message || "Failed to create pending";
    console.error("Pending creation error:", err);
  } finally {
    createPendingLoading.value = false;
  }
}
</script>

<template>
  <div v-if="isInitialized" class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Test Order Creation</h1>

      <!-- Auth Status -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 class="text-sm font-semibold text-blue-800 mb-2">Auth Status</h2>
        <div class="text-sm text-blue-700">
          <div>Authenticated: {{ user ? "Yes" : "No" }}</div>
          <div>User object: {{ user ? "EXISTS" : "NULL" }}</div>
          <div v-if="user">User: {{ user.displayName || user.email }}</div>
          <div v-if="user">Email: {{ user.email }}</div>
          <div v-if="user">Email Verified: {{ user.emailVerified }}</div>
          <div v-if="user">UID: {{ user.uid }}</div>
          <div v-if="user">
            Custom Claims: {{ JSON.stringify(user.customClaims || {}) }}
          </div>
          <div v-if="user">
            Role from claims: {{ user.customClaims?.role || "None" }}
          </div>
          <div v-if="loadingRole">Loading role...</div>
          <div v-else-if="userRole">Role: {{ userRole }}</div>
          <div v-else-if="user">Role: Not found in Firestore or claims</div>
          <div v-else>No user data available</div>
        </div>

        <div class="mt-3">
          <router-link
            to="/dashboard"
            class="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            Go to Dashboard
          </router-link>
        </div>
      </div>

      <!-- Order Form -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      >
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Create New Order
        </h2>

        <form @submit.prevent="handleCreateOrder" class="space-y-4">
          <!-- Month -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Month</label
            >
            <input
              v-model="formData.month"
              type="month"
              required
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <!-- Status -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1"
              >Status</label
            >
            <select
              v-model="formData.status"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option
                v-for="status in ORDER_STATUSES"
                :key="status"
                :value="status"
              >
                {{ status.charAt(0).toUpperCase() + status.slice(1) }}
              </option>
            </select>
          </div>

          <!-- Dynamic Fields from Column Definitions -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700">
                Dynamic Fields (from Column Definitions)
              </label>
              <div class="text-xs text-gray-500">
                {{ dynamicColumns.length }} fields visible for
                {{ userRole || "unknown role" }}
              </div>
            </div>

            <div v-if="columnsStore.loading" class="text-gray-500 text-sm">
              Loading column definitions...
            </div>

            <div
              v-else-if="dynamicColumns.length === 0"
              class="text-gray-500 text-sm"
            >
              No dynamic columns available for your role.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="column in dynamicColumns"
                :key="column.key"
                class="flex items-center gap-2"
              >
                <div class="flex-1">
                  <label class="block text-xs text-gray-600 mb-1">
                    {{ column.label }}
                    <span class="text-gray-400">({{ column.type }})</span>
                  </label>

                  <!-- Text input -->
                  <input
                    v-if="column.type === 'text'"
                    :value="getFieldValue(column.key)"
                    @input="updateDynamicField(column.key, $event.target.value)"
                    type="text"
                    :placeholder="column.label"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <!-- Number input -->
                  <input
                    v-else-if="column.type === 'number'"
                    :value="getFieldValue(column.key)"
                    @input="
                      updateDynamicField(
                        column.key,
                        Number($event.target.value),
                      )
                    "
                    type="number"
                    :placeholder="column.label"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <!-- Date input -->
                  <input
                    v-else-if="column.type === 'date'"
                    :value="getFieldValue(column.key)"
                    @input="updateDynamicField(column.key, $event.target.value)"
                    type="date"
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <!-- Select input -->
                  <select
                    v-else-if="column.type === 'select'"
                    :value="getFieldValue(column.key)"
                    @change="
                      updateDynamicField(column.key, $event.target.value)
                    "
                    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select {{ column.label }}</option>
                    <option
                      v-for="option in column.options"
                      :key="option"
                      :value="option"
                    >
                      {{ option }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="loading"
            class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Creating Order...</span>
            <span v-else>Create Order</span>
          </button>
        </form>
      </div>

      <!-- Messages -->
      <div
        v-if="error"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">Error</h3>
        <p class="text-sm text-red-700">{{ error }}</p>
      </div>

      <div
        v-if="success"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">Success</h3>
        <p class="text-sm text-green-700">{{ success }}</p>
      </div>
    </div>

    <!-- Update Order Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Update Order
      </h2>

      <form @submit.prevent="handleUpdateOrder" class="space-y-4">
        <!-- Order ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Order ID</label
          >
          <input
            v-model="updateOrderId"
            type="text"
            placeholder="Enter order ID to update"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Field -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Field</label
          >
          <input
            v-model="updateField"
            type="text"
            placeholder="e.g., {{ DEFAULT_FIELD }}"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Value -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >New Value</label
          >
          <input
            v-model="updateValue"
            type="text"
            placeholder="New value for the field"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Version Info (Auto-fetched) -->
        <div v-if="currentOrder" class="bg-gray-50 rounded-lg p-3">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-sm font-medium text-gray-700"
                >Current Version:</span
              >
              <span class="ml-2 text-sm font-semibold text-blue-600">{{
                currentOrder.version
              }}</span>
            </div>
            <div class="text-xs text-gray-500">
              Order {{ currentOrder.id.slice(0, 8) }}...
            </div>
          </div>
          <div class="text-xs text-gray-600 mt-1">
            Version will be automatically used for optimistic locking
          </div>
        </div>
        <div
          v-else
          class="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
        >
          <div class="text-sm text-yellow-800">
            Select an order ID to see current version
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="updateLoading"
          class="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="updateLoading">Updating Order...</span>
          <span v-else>Update Order</span>
        </button>
      </form>

      <!-- Update Messages -->
      <div
        v-if="updateError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">Update Error</h3>
        <p class="text-sm text-red-700">{{ updateError }}</p>
      </div>

      <div
        v-if="updateSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Update Success
        </h3>
        <p class="text-sm text-green-700">{{ updateSuccess }}</p>
      </div>
    </div>

    <!-- Current Orders (for reference) -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Current Orders ({{ ordersStore.activeOrders.length }})
      </h2>

      <div v-if="ordersStore.loading" class="text-gray-500 text-center py-4">
        Loading orders...
      </div>

      <div
        v-else-if="ordersStore.activeOrders.length === 0"
        class="text-gray-500 text-center py-4"
      >
        No orders found for {{ formData?.month || "selected month" }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="order in ordersStore.activeOrders"
          :key="order.id"
          class="border border-gray-200 rounded-lg p-3"
        >
          <div class="flex justify-between items-start">
            <div>
              <div class="font-medium text-gray-900">ID: {{ order.id }}</div>
              <div class="text-sm text-gray-600">
                Status: {{ order.status }}
              </div>
              <div class="text-sm text-gray-600">
                Version: {{ order.version }}
              </div>
              <div v-if="order.customer_name" class="text-sm text-gray-600">
                Customer: {{ order.customer_name }}
              </div>
            </div>
            <div class="flex gap-2">
              <button
                @click="
                  updateOrderId = order.id;
                  updateValue = TEST_VALUES.first;
                  updateVersion = order.version;
                "
                class="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Use for Test
              </button>
              <button
                @click="
                  createPendingData.targetId = order.id;
                  createPendingData.baseVersion = order.version;
                "
                class="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
              >
                Create Pending
              </button>
              <button
                v-if="['manager', 'super_admin'].includes(authStore.userRole)"
                @click="deleteOrderId = order.id"
                class="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
              >
                Soft Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Version Conflict Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Version Conflict (Optimistic Locking)
      </h2>

      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
        <h3 class="text-sm font-semibold text-yellow-800 mb-2">
          What This Tests:
        </h3>
        <ul class="text-sm text-yellow-700 space-y-1">
          <li>• Step 1: Update order with version 1 (should succeed)</li>
          <li>• Step 2: Try to update with same version 1 (should conflict)</li>
          <li>• Step 3: Update with version 2 (should succeed)</li>
        </ul>
      </div>

      <form @submit.prevent="handleVersionConflict" class="space-y-4">
        <!-- Order ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Order ID for Conflict Test</label
          >
          <input
            v-model="conflictOrderId"
            type="text"
            placeholder="Enter order ID to test conflict"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="conflictLoading"
          class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="conflictLoading">Testing Conflict...</span>
          <span v-else>Test Version Conflict</span>
        </button>
      </form>

      <!-- Conflict Test Messages -->
      <div
        v-if="conflictError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">
          Conflict Test Error
        </h3>
        <p class="text-sm text-red-700">{{ conflictError }}</p>
      </div>

      <div
        v-if="conflictSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Conflict Test Results
        </h3>
        <p class="text-sm text-green-700 whitespace-pre-line">
          {{ conflictSuccess }}
        </p>
      </div>
    </div>

    <!-- Soft Delete Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Soft Delete Order
      </h2>

      <!-- Role-based Info -->
      <div
        v-if="canDelete"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-2">
          What This Tests:
        </h3>
        <ul class="text-sm text-red-700 space-y-1">
          <li>
            • Soft deletes an order (marks as deleted, doesn't remove from
            database)
          </li>
          <li>• Order will be hidden from active orders list</li>
          <li>• Can be recovered later if needed</li>
        </ul>
      </div>

      <div
        v-else
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-yellow-800 mb-2">
          Backend Permission Test
        </h3>
        <p class="text-sm text-yellow-700">
          You can submit this form to test backend Firestore rules. Expected
          result: <strong>Permission Denied</strong> error. Your current role:
          <strong>{{ authStore.userRole || "Unknown" }}</strong>
        </p>
      </div>

      <form @submit.prevent="handleSoftDelete" class="space-y-4">
        <!-- Order ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Order ID to Soft Delete</label
          >
          <input
            v-model="deleteOrderId"
            type="text"
            placeholder="Enter order ID to soft delete"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="deleteLoading"
          class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="deleteLoading">Testing Backend...</span>
          <span v-else-if="canDelete">Soft Delete Order</span>
          <span v-else>Test Backend (Should Fail)</span>
        </button>
      </form>

      <!-- Soft Delete Messages -->
      <div
        v-if="deleteError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">
          Soft Delete Error
        </h3>
        <p class="text-sm text-red-700">{{ deleteError }}</p>
      </div>

      <div
        v-if="deleteSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Soft Delete Success
        </h3>
        <p class="text-sm text-green-700">{{ deleteSuccess }}</p>
      </div>
    </div>

    <!-- Costs Store Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Costs Store (Manager/Super Admin Only)
      </h2>

      <!-- Permission Info -->
      <div
        v-if="canAccessCosts"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-2">
          Access Granted
        </h3>
        <p class="text-sm text-green-700">
          You have permission to access costs data as
          <strong>{{ authStore.userRole }}</strong
          >.
        </p>
      </div>

      <div
        v-else
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-yellow-800 mb-2">
          Backend Permission Test
        </h3>
        <p class="text-sm text-yellow-700">
          Only <strong>Manager</strong> and <strong>Super Admin</strong> can
          access costs data. Your current role:
          <strong>{{ authStore.userRole || "Unknown" }}</strong> <br />Expected
          result: <strong>Permission Denied</strong> error.
        </p>
      </div>

      <form @submit.prevent="handleFetchCosts" class="space-y-4">
        <!-- Month -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Month (YYYY-MM format)</label
          >
          <input
            v-model="costsMonth"
            type="text"
            placeholder="e.g., 2024-01"
            pattern="[0-9]{4}-[0-9]{2}"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="text-xs text-gray-500 mt-1">
            Format: YYYY-MM (e.g., 2024-01, 2024-02)
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="costsLoading"
          class="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="costsLoading">Fetching Costs...</span>
          <span v-else-if="canAccessCosts">Fetch Costs</span>
          <span v-else>Test Backend (Should Fail)</span>
        </button>
      </form>

      <!-- Manual Refresh Button -->
      <div class="mt-4">
        <button
          @click="handleFetchCosts"
          :disabled="costsLoading"
          class="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="costsLoading">Refreshing...</span>
          <span v-else>Manual Refresh</span>
        </button>
        <p class="text-xs text-gray-500 mt-1">
          Use this to manually refresh costs after making changes in Firestore
        </p>
      </div>

      <!-- Costs Messages -->
      <div
        v-if="costsError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">
          Costs Fetch Error
        </h3>
        <p class="text-sm text-red-700">{{ costsError }}</p>
      </div>

      <div
        v-if="costsSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Costs Fetch Success
        </h3>
        <p class="text-sm text-green-700 whitespace-pre-line">
          {{ costsSuccess }}
        </p>
      </div>

      <!-- Current Costs Display -->
      <div
        v-if="
          costsStore.activeCosts.length > 0 ||
          costsStore.deletedCosts.length > 0
        "
        class="mt-4"
      >
        <h3 class="text-sm font-semibold text-gray-700 mb-2">
          Current Costs Data:
        </h3>

        <div v-if="costsStore.activeCosts.length > 0" class="mb-3">
          <h4 class="text-xs font-medium text-gray-600 mb-1">
            Active Costs ({{ costsStore.activeCosts.length }}):
          </h4>
          <div
            class="bg-gray-50 rounded p-2 text-xs text-gray-700 max-h-32 overflow-y-auto"
          >
            <div
              v-for="cost in costsStore.activeCosts.slice(0, 5)"
              :key="cost.id"
              class="mb-1"
            >
              • {{ cost.id?.slice(0, 8) || "N/A" }}... -
              {{ cost.month || "N/A" }} - ${{ cost.amount || "N/A" }}
            </div>
            <div v-if="costsStore.activeCosts.length > 5" class="text-gray-500">
              ... and {{ costsStore.activeCosts.length - 5 }} more
            </div>
          </div>
        </div>

        <div v-if="costsStore.deletedCosts.length > 0" class="mb-3">
          <h4 class="text-xs font-medium text-gray-600 mb-1">
            Deleted Costs ({{ costsStore.deletedCosts.length }}):
          </h4>
          <div
            class="bg-red-50 rounded p-2 text-xs text-gray-700 max-h-32 overflow-y-auto"
          >
            <div
              v-for="cost in costsStore.deletedCosts.slice(0, 5)"
              :key="cost.id"
              class="mb-1"
            >
              • {{ cost.id?.slice(0, 8) || "N/A" }}... -
              {{ cost.month || "N/A" }} - ${{ cost.amount || "N/A" }} (deleted)
            </div>
            <div
              v-if="costsStore.deletedCosts.length > 5"
              class="text-gray-500"
            >
              ... and {{ costsStore.deletedCosts.length - 5 }} more
            </div>
          </div>
        </div>
      </div>

      <!-- Debug Info for Costs -->
      <div class="bg-gray-50 rounded-lg p-4 mt-4">
        <h3 class="text-sm font-semibold text-gray-700 mb-2">
          Costs Store Debug Info:
        </h3>
        <div class="text-xs text-gray-600 space-y-1">
          <div>Current Month: {{ costsStore.currentMonth || "None" }}</div>
          <div>Loading: {{ costsStore.loading }}</div>
          <div>Error: {{ costsStore.error || "None" }}</div>
          <div>Active Costs Count: {{ costsStore.activeCosts.length }}</div>
          <div>Deleted Costs Count: {{ costsStore.deletedCosts.length }}</div>
          <div>
            All Costs Size:
            {{ costsStore.costs?.size || costsStore.costs?.length || 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Create Cost Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Create Cost Entry (Manager/Super Admin Only)
      </h2>

      <!-- Permission Info -->
      <div
        v-if="canAccessCosts"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-2">
          Access Granted
        </h3>
        <p class="text-sm text-green-700">
          You have permission to create cost entries as
          <strong>{{ authStore.userRole }}</strong
          >.
        </p>
      </div>

      <div
        v-else
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-yellow-800 mb-2">
          Backend Permission Test
        </h3>
        <p class="text-sm text-yellow-700">
          Only <strong>Manager</strong> and <strong>Super Admin</strong> can
          create cost entries. Your current role:
          <strong>{{ authStore.userRole || "Unknown" }}</strong> <br />Expected
          result: <strong>Permission Denied</strong> error.
        </p>
      </div>

      <form @submit.prevent="handleCreateCost" class="space-y-4">
        <!-- Month -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Month (YYYY-MM format)</label
          >
          <input
            v-model="createCostData.month"
            type="text"
            placeholder="e.g., 2026-03"
            pattern="[0-9]{4}-[0-9]{2}"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="text-xs text-gray-500 mt-1">
            Format: YYYY-MM (e.g., 2026-03, 2026-04)
          </div>
        </div>

        <!-- Status -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Status</label
          >
          <select
            v-model="createCostData.status"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <!-- Dynamic Fields -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Dynamic Fields (JSON format)
          </label>
          <textarea
            v-model="dynamicFieldsText"
            @input="updateDynamicFields"
            rows="4"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder='{"material_cost": 5000, "labor_cost": 3000}'
          ></textarea>
          <div class="text-xs text-gray-500 mt-1">
            Enter valid JSON format. Example: {"material_cost": 5000,
            "labor_cost": 3000}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="createCostLoading"
          class="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="createCostLoading">Creating Cost...</span>
          <span v-else-if="canAccessCosts">Create Cost Entry</span>
          <span v-else>Test Backend (Should Fail)</span>
        </button>
      </form>

      <!-- Create Cost Messages -->
      <div
        v-if="createCostError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">
          Cost Creation Error
        </h3>
        <p class="text-sm text-red-700">{{ createCostError }}</p>
      </div>

      <div
        v-if="createCostSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Cost Creation Success
        </h3>
        <p class="text-sm text-green-700 whitespace-pre-line">
          {{ createCostSuccess }}
        </p>
      </div>
    </div>

    <!-- Create Pending Test Section -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">
        Test Create Pending Change
      </h2>

      <!-- Permission Info -->
      <div
        v-if="canCreatePending"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-2">
          Access Granted
        </h3>
        <p class="text-sm text-green-700">
          You have permission to create pending changes as
          <strong>{{ authStore.userRole }}</strong
          >.
        </p>
      </div>

      <div
        v-else
        class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
      >
        <h3 class="text-sm font-semibold text-yellow-800 mb-2">
          Permission Required
        </h3>
        <p class="text-sm text-yellow-700">
          Only authenticated users can create pending changes. Your current
          role: <strong>{{ authStore.userRole || "Unknown" }}</strong>
        </p>
      </div>

      <form @submit.prevent="handleCreatePending" class="space-y-4">
        <!-- Target Collection -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Target Collection</label
          >
          <select
            v-model="createPendingData.targetCollection"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="orders">Orders</option>
            <option value="costs">Costs</option>
          </select>
        </div>

        <!-- Target ID -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Target ID</label
          >
          <input
            v-model="createPendingData.targetId"
            type="text"
            placeholder="Enter order/cost ID or use 'Create Pending' button above"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="text-xs text-gray-500 mt-1">
            Click "Create Pending" on any order above to auto-fill this field
          </div>
        </div>

        <!-- Field -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Field to Change</label
          >
          <input
            v-model="createPendingData.field"
            type="text"
            placeholder="e.g., order_value, customer_name, material_cost"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <!-- Current Data (Fetched from Firestore) -->
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 class="text-sm font-medium text-gray-700 mb-3">
            Current Document Data
          </h3>

          <div v-if="fetchingTargetData" class="text-sm text-gray-500">
            Fetching current data...
          </div>

          <div
            v-else-if="
              createPendingData.baseValue !== null &&
              createPendingData.baseVersion !== null
            "
            class="space-y-2"
          >
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Current Value:</span>
              <span class="text-sm font-medium text-gray-900">{{
                createPendingData.baseValue
              }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Current Version:</span>
              <span class="text-sm font-medium text-gray-900">{{
                createPendingData.baseVersion
              }}</span>
            </div>
          </div>

          <div v-else class="text-sm text-gray-500">
            Select a target document and field to fetch current data
          </div>
        </div>

        <!-- New Value -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >New Value (Proposed)</label
          >
          <input
            v-model.number="createPendingData.newValue"
            type="number"
            placeholder="Proposed new value"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div class="text-xs text-gray-500 mt-1">
            This will be the proposed change to {{ createPendingData.field }}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="createPendingLoading || !createPendingData.targetId"
          class="w-full px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="createPendingLoading">Creating Pending...</span>
          <span v-else>Create Pending Change</span>
        </button>
      </form>

      <!-- Create Pending Messages -->
      <div
        v-if="createPendingError"
        class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-red-800 mb-1">
          Pending Creation Error
        </h3>
        <p class="text-sm text-red-700">{{ createPendingError }}</p>
      </div>

      <div
        v-if="createPendingSuccess"
        class="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 mt-4"
      >
        <h3 class="text-sm font-semibold text-green-800 mb-1">
          Pending Creation Success
        </h3>
        <p class="text-sm text-green-700 whitespace-pre-line">
          {{ createPendingSuccess }}
        </p>
      </div>

      <!-- Link to Pending Review -->
      <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-sm text-blue-700">
          <strong>Next Step:</strong> View and manage pending changes in the
          <a
            href="/pending-review"
            class="text-blue-800 underline hover:text-blue-900"
            >Pending Review</a
          >
          page.
        </p>
      </div>
    </div>

    <!-- Debug Info -->
    <div class="bg-gray-50 rounded-lg p-4 mt-6">
      <h3 class="text-sm font-semibold text-gray-700 mb-2">Debug Info</h3>

      <div class="mb-4">
        <h4 class="text-xs font-semibold text-gray-600 mb-1">Form Data:</h4>
        <pre class="text-xs text-gray-600 overflow-x-auto">{{
          JSON.stringify(formData, null, 2)
        }}</pre>
      </div>

      <div class="mb-4">
        <h4 class="text-xs font-semibold text-gray-600 mb-1">
          User Role: {{ authStore.userRole }}
        </h4>
      </div>

      <div class="mb-4">
        <h4 class="text-xs font-semibold text-gray-600 mb-1">
          Column Definitions ({{ columnsStore.definitions.length }}):
        </h4>
        <pre class="text-xs text-gray-600 overflow-x-auto">{{
          JSON.stringify(columnsStore.definitions, null, 2)
        }}</pre>
      </div>

      <div class="mb-4">
        <h4 class="text-xs font-semibold text-gray-600 mb-1">
          Role Permissions:
        </h4>
        <pre class="text-xs text-gray-600 overflow-x-auto">{{
          JSON.stringify(columnsStore.permissions, null, 2)
        }}</pre>
      </div>

      <div>
        <h4 class="text-xs font-semibold text-gray-600 mb-1">
          Visible Columns ({{ dynamicColumns.length }}):
        </h4>
        <pre class="text-xs text-gray-600 overflow-x-auto">{{
          JSON.stringify(dynamicColumns, null, 2)
        }}</pre>
      </div>
    </div>
  </div>
</template>
