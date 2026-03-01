<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useOrdersStore } from "@/stores/orders";
import { useAuthStore } from "@/stores/auth";
import { useColumnsStore } from "@/stores/columns";
import { useAuth } from "@/composables/useAuth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const ordersStore = useOrdersStore();
const authStore = useAuthStore();
const columnsStore = useColumnsStore();
const { currentUser: user } = useAuth();

// User role from Firestore
const userRole = ref(null);
const loadingRole = ref(false);

// Form state
const formData = ref({
  month: new Date().toISOString().slice(0, 7), // YYYY-MM
  status: "active",
  dynamic_fields: {},
});

const loading = ref(false);
const error = ref(null);
const success = ref(null);

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
const allowedRoles = ["super_admin", "manager", "jr_sales", "sr_sales"];

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
  // Set current month in orders store
  ordersStore.currentMonth = formData.value.month;
  ordersStore.fetchOrders(formData.value.month);
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
    ordersStore.currentMonth = formData.value.month;

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
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-8">
    <div class="max-w-4xl mx-auto">
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
            to="/login"
            class="text-blue-600 hover:text-blue-800 text-sm"
          >
            Go to Login Page
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
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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

      <!-- Current Orders -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          Current Orders ({{ ordersStore.currentMonth || "No month selected" }})
        </h2>

        <div v-if="ordersStore.loading" class="text-gray-500">
          Loading orders...
        </div>

        <div
          v-else-if="ordersStore.activeOrders.length === 0"
          class="text-gray-500"
        >
          No orders found for this month.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="order in ordersStore.activeOrders"
            :key="order.id"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium text-gray-900">
                {{ order.id.slice(0, 8) }}...
              </div>
              <div class="text-sm text-gray-500">
                Version: {{ order.version }}
              </div>
            </div>
            <div class="text-sm text-gray-600 space-y-1">
              <div>Status: {{ order.status }}</div>
              <div>Created: {{ order.createdByName }}</div>
              <div v-if="order.dynamic_fields">
                <div
                  v-for="(value, key) in order.dynamic_fields"
                  :key="key"
                  class="text-xs"
                >
                  {{ key }}: {{ value }}
                </div>
              </div>
            </div>
          </div>
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
  </div>
</template>
