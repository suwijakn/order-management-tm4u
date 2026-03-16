<script setup>
import { onMounted, onUnmounted, computed, ref, watch, inject } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useColumnsStore } from "@/stores/columns";
import { usePendingsStore } from "@/stores/pendings";
import { useRouter } from "vue-router";
import SkeletonLoader from "@/components/SkeletonLoader.vue";
import { SpreadsheetGrid } from "@/components/spreadsheet";

const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const columnsStore = useColumnsStore();
const pendingsStore = usePendingsStore();
const router = useRouter();

const selectedMonth = inject(
  "selectedMonth",
  ref(new Date().toISOString().slice(0, 7)),
);

// Check if user has allowed role for dashboard access
const allowedRoles = ["super_admin", "manager", "jr_sales", "sr_sales"];

// Computed property to check if user is authorized
const isAuthorized = computed(() => {
  if (!authStore.isAuthenticated) return false;
  const userRole = authStore.userRole;
  return userRole && allowedRoles.includes(userRole);
});

// Watch for month changes and refetch orders
watch(selectedMonth, (newMonth) => {
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

// Event handlers for SpreadsheetGrid
function handleOrderUpdated(payload) {
  // Order updated event
}

function handleOrderCreated(payload) {
  // Order created event
}

function handleOrderDeleted(payload) {
  // Order deleted event
}

onMounted(() => {
  // Fetch column definitions and role permissions
  columnsStore.fetchColumns();
  ordersStore.fetchOrders(selectedMonth.value);

  // Fetch all pending changes for field indicators
  pendingsStore.fetchAllPendings();
});

onUnmounted(() => {
  // Store cleanup is handled at the layout level, not per-view
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
  <div>
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

    <!-- Spreadsheet Grid Component -->
    <SpreadsheetGrid
      :month="selectedMonth"
      :show-deleted="false"
      @order-updated="handleOrderUpdated"
      @order-created="handleOrderCreated"
      @order-deleted="handleOrderDeleted"
    />
  </div>
</template>
