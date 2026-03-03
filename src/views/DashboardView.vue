<script setup>
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useColumnsStore } from "@/stores/columns";
import { usePendingsStore } from "@/stores/pendings";
import { useRouter } from "vue-router";
import ModernDashboardLayout from "@/layouts/ModernDashboardLayout.vue";
import SkeletonLoader from "@/components/SkeletonLoader.vue";

const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const columnsStore = useColumnsStore();
const pendingsStore = usePendingsStore();
const router = useRouter();

// Default to current month in YYYY-MM format, but allow user to change
const selectedMonth = ref(new Date().toISOString().slice(0, 7));

// Handle month change from layout
function handleMonthChange(newMonth) {
  selectedMonth.value = newMonth;
}

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

  // FIRST: Check for Date objects and Firestore Timestamps (regardless of column type)
  // This handles createdAt, updatedAt, etc.
  if (typeof value === "object" && value !== null) {
    // JavaScript Date object (already converted from Firestore Timestamp)
    if (value instanceof Date) {
      const dateStr = value.toLocaleDateString();
      const timeStr = value.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${dateStr} ${timeStr}`;
    }
    // Firestore Timestamp with toDate method
    if (value.toDate && typeof value.toDate === "function") {
      const date = value.toDate();
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${dateStr} ${timeStr}`;
    }
    // Firestore Timestamp as plain object with seconds/nanoseconds
    if (typeof value.seconds === "number") {
      const date = new Date(value.seconds * 1000);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${dateStr} ${timeStr}`;
    }
  }

  // Handle explicit date/timestamp column type with string values
  if ((columnType === "date" || columnType === "timestamp") && value) {
    try {
      const date = new Date(value);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      return `${dateStr} ${timeStr}`;
    } catch {
      return String(value);
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
  const pending = pendingsStore.allPendingItems.find((p) => {
    // Match targetId
    if (p.targetId !== orderId) return false;

    // Match field - handle both "field" and "dynamic_fields.field" formats
    const pendingField = p.field;
    const normalizedPendingField = pendingField.replace("dynamic_fields.", "");

    return pendingField === fieldKey || normalizedPendingField === fieldKey;
  });

  return pending;
}

// Check if a field has a pending change
function hasPendingChange(orderId, fieldKey) {
  const result = !!getPendingForField(orderId, fieldKey);
  if (pendingsStore.allPendingItems.length > 0) {
    console.log(
      `[Dashboard] hasPendingChange(${orderId}, ${fieldKey}) = ${result}`,
    );
  }
  return result;
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
  console.log("[Dashboard] Fetching all pending changes...");
  pendingsStore.fetchAllPendings();

  // Debug: Log pending changes after a delay
  setTimeout(() => {
    console.log(
      "[Dashboard] All pending items:",
      pendingsStore.allPendingItems,
    );
    console.log(
      "[Dashboard] Pending count:",
      pendingsStore.allPendingItems.length,
    );
  }, 2000);
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

  <!-- Dashboard Content with Layout (only shown if authorized) -->
  <ModernDashboardLayout
    v-else-if="isAuthorized"
    @month-change="handleMonthChange"
  >
    <template #title>Spreadsheet</template>

    <!-- Welcome section -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
      <p class="text-gray-600 mt-1">Welcome to the Order Management System</p>
    </div>

    <!-- Stat Cards with Skeleton Loaders -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <template v-if="ordersStore.loading">
        <SkeletonLoader v-for="i in 4" :key="i" type="stat" />
      </template>
      <template v-else>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Total Orders</div>
          <div class="text-3xl font-bold text-gray-900 mt-2">
            {{ totalOrders }}
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Active</div>
          <div class="text-3xl font-bold text-yellow-600 mt-2">
            {{ pendingOrders }}
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Completed</div>
          <div class="text-3xl font-bold text-green-600 mt-2">
            {{ completedOrders }}
          </div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm text-gray-500">Month</div>
          <div class="text-3xl font-bold text-blue-600 mt-2">
            {{ selectedMonth }}
          </div>
        </div>
      </template>
    </div>

    <!-- Error banner -->
    <div
      v-if="ordersStore.error"
      class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ ordersStore.error }}
    </div>

    <!-- Orders List -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">
          Orders — {{ selectedMonth }}
        </h3>
      </div>

      <div class="p-6">
        <!-- Loading state with skeleton -->
        <div v-if="ordersStore.loading || columnsStore.loading">
          <SkeletonLoader type="table" :lines="5" />
        </div>

        <!-- No orders -->
        <div
          v-else-if="ordersStore.activeOrders.length === 0"
          class="text-gray-500 text-center py-8"
        >
          <svg
            class="w-12 h-12 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No orders for {{ selectedMonth }}.</p>
          <p class="text-sm mt-1">Try selecting a different month.</p>
        </div>

        <!-- No columns visible for this role -->
        <div
          v-else-if="visibleColumns.length === 0"
          class="text-gray-500 text-center py-8"
        >
          <svg
            class="w-12 h-12 mx-auto text-gray-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p>
            No columns are visible for your role ({{ authStore.userRole }}).
          </p>
          <p class="text-sm mt-1">
            Contact your administrator to configure column permissions.
          </p>
        </div>

        <!-- Dynamic table based on column_definitions and role_permissions -->
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <!-- ID column -->
                <th class="pb-3 pr-4 whitespace-nowrap font-medium">ID</th>
                <!-- Dynamic columns based on role permissions -->
                <th
                  v-for="col in visibleColumns"
                  :key="col.key"
                  class="pb-3 pr-4 whitespace-nowrap font-medium"
                >
                  {{ col.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="order in ordersStore.activeOrders"
                :key="order.id"
                class="border-b last:border-0 hover:bg-gray-50 transition-colors"
              >
                <!-- ID column -->
                <td class="py-3 pr-4 font-mono text-xs text-gray-500">
                  {{ order.id.slice(0, 8) }}…
                </td>
                <!-- Dynamic columns -->
                <td
                  v-for="col in visibleColumns"
                  :key="col.key"
                  class="py-3 pr-4"
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
                        class="fixed z-[9999] w-72 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-4"
                        :style="{
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                        }"
                      >
                        <div class="font-semibold text-amber-400 mb-3 text-sm">
                          ⏳ Pending Change Request
                        </div>
                        <div class="space-y-2">
                          <div class="flex justify-between">
                            <span class="text-gray-400">Requested by:</span>
                            <span class="text-white font-medium">{{
                              getPendingForField(order.id, col.key)
                                ?.requestedByName || "—"
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-400">Requested at:</span>
                            <span class="text-white">{{
                              formatDateTime(
                                getPendingForField(order.id, col.key)
                                  ?.requestedAt,
                              )
                            }}</span>
                          </div>
                          <div class="flex justify-between">
                            <span class="text-gray-400">New value:</span>
                            <span class="text-green-400 font-bold">{{
                              getPendingForField(order.id, col.key)?.newValue ??
                              "—"
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </ModernDashboardLayout>
</template>
