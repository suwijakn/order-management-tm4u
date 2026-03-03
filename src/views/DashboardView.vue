<script setup>
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useColumnsStore } from "@/stores/columns";
import { usePendingsStore } from "@/stores/pendings";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const columnsStore = useColumnsStore();
const pendingsStore = usePendingsStore();
const router = useRouter();

// Default to current month in YYYY-MM format, but allow user to change
const selectedMonth = ref(new Date().toISOString().slice(0, 7));

// Check if user has allowed role for dashboard access
const allowedRoles = ["super_admin", "manager", "jr_sales", "sr_sales"];

// Computed property to check if user is authorized
const isAuthorized = computed(() => {
  if (!authStore.isAuthenticated) return false;

  const userRole = authStore.userRole;

  console.log("[Dashboard] Authorization check:", {
    userRole,
    allowedRoles,
    isAuthorized: userRole && allowedRoles.includes(userRole),
  });

  return userRole && allowedRoles.includes(userRole);
});

// Watch for month changes and refetch orders
watch(selectedMonth, (newMonth) => {
  console.log("[Dashboard] Month changed to:", newMonth);
  ordersStore.fetchOrders(newMonth);
});

// Get visible columns for current user's role
const visibleColumns = computed(() => {
  const role = authStore.userRole;
  if (!role) return [];
  return columnsStore.visibleColumns(role);
});

// Get the value from an order's dynamic_fields for a given column key
function getOrderFieldValue(order, columnKey) {
  // Check if it's a system field (top-level)
  if (order[columnKey] !== undefined) {
    return order[columnKey];
  }
  // Otherwise check dynamic_fields
  return order.dynamic_fields?.[columnKey] ?? "—";
}

// Format value for display based on column type
function formatValue(value, columnType) {
  if (value === null || value === undefined || value === "") return "—";

  if (columnType === "date" && value) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  if (columnType === "number" && typeof value === "number") {
    return value.toLocaleString();
  }

  return value;
}

// Check if user is Manager or Super Admin (can approve/reject pendings)
const isManagerOrAbove = computed(() => {
  return ["manager", "super_admin"].includes(authStore.userRole);
});

// Count of pending changes for notification badge (only for managers)
const pendingCount = computed(() => {
  return pendingsStore.allPendingItems.length;
});

// Get pending change for a specific order + field combination
function getPendingForField(orderId, fieldKey) {
  return pendingsStore.allPendingItems.find(
    (p) => p.targetId === orderId && p.field === fieldKey,
  );
}

// Check if a field has a pending change
function hasPendingChange(orderId, fieldKey) {
  return !!getPendingForField(orderId, fieldKey);
}

// Format date for tooltip display
function formatDateTime(date) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return "—";
  }
}

// Tooltip state
const activeTooltip = ref(null);

function showTooltip(orderId, fieldKey) {
  activeTooltip.value = `${orderId}_${fieldKey}`;
}

function hideTooltip() {
  activeTooltip.value = null;
}

function isTooltipVisible(orderId, fieldKey) {
  return activeTooltip.value === `${orderId}_${fieldKey}`;
}

onMounted(() => {
  console.log(
    "[Dashboard] Mounting, fetching orders for:",
    selectedMonth.value,
  );
  console.log("[Dashboard] Current user role:", authStore.userRole);

  // Fetch column definitions and role permissions
  columnsStore.fetchColumns();
  ordersStore.fetchOrders(selectedMonth.value);

  // Fetch all pending changes for field indicators
  pendingsStore.fetchAllPendings();
});

onUnmounted(() => {
  ordersStore.cleanup();
  columnsStore.cleanup();
  pendingsStore.cleanup();
});

const totalOrders = computed(() => ordersStore.activeOrders.length);
const pendingOrders = computed(
  () => ordersStore.activeOrders.filter((o) => o.status === "active").length,
);
const completedOrders = computed(
  () => ordersStore.activeOrders.filter((o) => o.status === "completed").length,
);

async function handleLogout() {
  ordersStore.cleanup();
  await authStore.logout();
  router.push({ name: "Login" });
}
</script>

<template>
  <!-- Access Denied Message -->
  <div
    v-if="!isAuthorized && authStore.isAuthenticated"
    class="min-h-screen bg-gray-50 flex items-center justify-center"
  >
    <div class="max-w-md w-full mx-4">
      <div class="bg-white rounded-lg shadow-lg p-8 text-center">
        <div
          class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.082 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 class="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p class="text-gray-600 mb-4">
          You don't have permission to access this page. Only users with the
          following roles can view the dashboard:
        </p>
        <div class="bg-gray-50 rounded-lg p-4 mb-6">
          <ul class="text-sm text-gray-700 space-y-1">
            <li>• Super Admin</li>
            <li>• Manager</li>
            <li>• Senior Sales</li>
            <li>• Junior Sales</li>
          </ul>
        </div>
        <button
          @click="handleLogout"
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Logout
        </button>
      </div>
    </div>
  </div>

  <!-- Dashboard Content (only shown if authorized) -->
  <div v-else-if="isAuthorized" class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-semibold text-gray-900">
              Order Management
            </h1>
          </div>
          <div class="flex items-center space-x-4">
            <!-- Pending Approvals Badge (Manager/Super Admin only) -->
            <router-link
              v-if="isManagerOrAbove"
              to="/pending-approvals"
              class="relative text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <span>Pending Approvals</span>
              <!-- Badge count -->
              <span
                v-if="pendingCount > 0"
                class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center"
              >
                {{ pendingCount > 99 ? "99+" : pendingCount }}
              </span>
            </router-link>

            <router-link
              to="/test-order-create"
              class="text-sm text-blue-600 hover:text-blue-800"
            >
              Test Order Create
            </router-link>
            <span class="text-sm text-gray-600">
              {{ authStore.userName }}
            </span>
            <div class="text-xs px-2 py-1 bg-gray-100 rounded">
              Role: {{ authStore.userRole || "NO_CUSTOM_CLAIMS" }}
            </div>
            <button @click="handleLogout" class="btn-secondary text-sm">
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p class="text-gray-600 mt-1">
              Welcome to the Order Management System
            </p>
          </div>

          <!-- Month Selector -->
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-gray-700">Month:</label>
            <input
              v-model="selectedMonth"
              type="month"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="card">
          <div class="text-sm text-gray-500">Total Orders</div>
          <div class="text-3xl font-bold text-gray-900 mt-2">
            {{ ordersStore.loading ? "…" : totalOrders }}
          </div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Active</div>
          <div class="text-3xl font-bold text-yellow-600 mt-2">
            {{ ordersStore.loading ? "…" : pendingOrders }}
          </div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Completed</div>
          <div class="text-3xl font-bold text-green-600 mt-2">
            {{ ordersStore.loading ? "…" : completedOrders }}
          </div>
        </div>
        <div class="card">
          <div class="text-sm text-gray-500">Month</div>
          <div class="text-3xl font-bold text-primary-600 mt-2">
            {{ selectedMonth }}
          </div>
        </div>
      </div>

      <!-- Error banner -->
      <div
        v-if="ordersStore.error"
        class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
      >
        {{ ordersStore.error }}
      </div>

      <!-- Orders List -->
      <div class="card">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Orders — {{ selectedMonth }}
        </h3>

        <!-- Loading state -->
        <div
          v-if="ordersStore.loading || columnsStore.loading"
          class="text-gray-400 text-center py-8"
        >
          Loading…
        </div>

        <!-- No orders -->
        <div
          v-else-if="ordersStore.activeOrders.length === 0"
          class="text-gray-500 text-center py-8"
        >
          No orders for {{ selectedMonth }}.
        </div>

        <!-- No columns visible for this role -->
        <div
          v-else-if="visibleColumns.length === 0"
          class="text-gray-500 text-center py-8"
        >
          No columns are visible for your role ({{ authStore.userRole }}).
          <p class="text-xs mt-2">
            Contact your administrator to configure column permissions.
          </p>
        </div>

        <!-- Dynamic table based on column_definitions and role_permissions -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <!-- ID column -->
                <th class="pb-2 pr-4 whitespace-nowrap">ID</th>
                <!-- Dynamic columns based on role permissions -->
                <th
                  v-for="col in visibleColumns"
                  :key="col.key"
                  class="pb-2 pr-4 whitespace-nowrap"
                >
                  {{ col.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in ordersStore.activeOrders"
                :key="order.id"
                class="border-b last:border-0 hover:bg-gray-50"
              >
                <!-- ID column -->
                <td class="py-2 pr-4 font-mono text-xs text-gray-500">
                  {{ order.id.slice(0, 8) }}…
                </td>
                <!-- Dynamic columns -->
                <td
                  v-for="col in visibleColumns"
                  :key="col.key"
                  class="py-2 pr-4"
                >
                  <div class="flex items-center gap-1">
                    <span>{{
                      formatValue(getOrderFieldValue(order, col.key), col.type)
                    }}</span>

                    <!-- Pending change indicator -->
                    <div
                      v-if="hasPendingChange(order.id, col.key)"
                      class="relative inline-block"
                      @mouseenter="showTooltip(order.id, col.key)"
                      @mouseleave="hideTooltip()"
                    >
                      <!-- Warning icon -->
                      <svg
                        class="w-4 h-4 text-amber-500 cursor-help"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fill-rule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clip-rule="evenodd"
                        />
                      </svg>

                      <!-- Tooltip -->
                      <div
                        v-if="isTooltipVisible(order.id, col.key)"
                        class="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg shadow-lg p-3"
                      >
                        <div class="font-semibold text-amber-400 mb-2">
                          ⏳ Pending Change Request
                        </div>
                        <div class="space-y-1">
                          <div>
                            <span class="text-gray-400">Requested by:</span>
                            <span class="ml-1">{{
                              getPendingForField(order.id, col.key)
                                ?.requestedByName
                            }}</span>
                          </div>
                          <div>
                            <span class="text-gray-400">Requested at:</span>
                            <span class="ml-1">{{
                              formatDateTime(
                                getPendingForField(order.id, col.key)
                                  ?.requestedAt,
                              )
                            }}</span>
                          </div>
                          <div>
                            <span class="text-gray-400">Current value:</span>
                            <span class="ml-1 text-gray-300">{{
                              getPendingForField(order.id, col.key)
                                ?.baseValue ?? "—"
                            }}</span>
                          </div>
                          <div>
                            <span class="text-gray-400">New value:</span>
                            <span class="ml-1 text-green-400 font-medium">{{
                              getPendingForField(order.id, col.key)?.newValue
                            }}</span>
                          </div>
                        </div>
                        <!-- Arrow -->
                        <div
                          class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"
                        ></div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>
