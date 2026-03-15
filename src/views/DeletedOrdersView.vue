<script setup>
import { onMounted, computed, ref, inject } from "vue";
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

const selectedMonth = inject(
  "selectedMonth",
  ref(new Date().toISOString().slice(0, 7)),
);

// Filters
const filterMonth = ref("");
const filterDateStart = ref("");
const filterDateEnd = ref("");
const sortOrder = ref("desc"); // desc = newest first

// Modals
const showPermanentDeleteModal = ref(false);
const deletingOrderId = ref(null);
const deletingOrder = ref(null);
const confirmOrderId = ref("");
const showViewDetailsModal = ref(false);
const viewingOrder = ref(null);

// Bulk selection
const selectedOrderIds = ref(new Set());

// Processing states
const processingId = ref(null);
const processingBulk = ref(false);

// Only Manager+ can view deleted orders
const isManagerOrAbove = computed(() => {
  return ["manager", "super_admin"].includes(authStore.userRole);
});

const isSuperAdmin = computed(() => {
  return authStore.userRole === "super_admin";
});

// Filtered and sorted deleted orders
const filteredDeletedOrders = computed(() => {
  let orders = ordersStore.deletedOrders;

  // Filter by month
  if (filterMonth.value) {
    orders = orders.filter((o) => o.month === filterMonth.value);
  }

  // Filter by deletion date range
  if (filterDateStart.value) {
    const startDate = new Date(filterDateStart.value);
    orders = orders.filter((o) => new Date(o.deletedAt) >= startDate);
  }
  if (filterDateEnd.value) {
    const endDate = new Date(filterDateEnd.value);
    endDate.setHours(23, 59, 59, 999);
    orders = orders.filter((o) => new Date(o.deletedAt) <= endDate);
  }

  // Sort by deletion date
  const sorted = [...orders].sort((a, b) => {
    const dateA = new Date(a.deletedAt);
    const dateB = new Date(b.deletedAt);
    return sortOrder.value === "desc" ? dateB - dateA : dateA - dateB;
  });

  return sorted;
});

// Get unique months from deleted orders
const availableMonths = computed(() => {
  const months = new Set();
  ordersStore.deletedOrders.forEach((o) => months.add(o.month));
  return Array.from(months).sort().reverse();
});

// Check if all visible orders are selected
const allSelected = computed(() => {
  if (filteredDeletedOrders.value.length === 0) return false;
  return filteredDeletedOrders.value.every((o) =>
    selectedOrderIds.value.has(o.id),
  );
});

const someSelected = computed(() => {
  return selectedOrderIds.value.size > 0 && !allSelected.value;
});

// Get days until auto-purge (30 days from deletion)
function getDaysUntilPurge(deletedAt) {
  if (!deletedAt) return null;
  const deleted = new Date(deletedAt);
  const purgeDate = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const diffMs = purgeDate - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getPurgeWarning(deletedAt) {
  const days = getDaysUntilPurge(deletedAt);
  if (days === null) return null;
  if (days < 0)
    return { text: "Overdue for purge", class: "text-red-600 font-semibold" };
  if (days === 0)
    return { text: "Purges today", class: "text-red-600 font-semibold" };
  if (days <= 3)
    return {
      text: `${days}d until purge`,
      class: "text-orange-600 font-semibold",
    };
  if (days <= 7)
    return { text: `${days}d until purge`, class: "text-orange-600" };
  return { text: `${days}d until purge`, class: "text-gray-600" };
}

// Lifecycle
onMounted(() => {
  if (!isManagerOrAbove.value) {
    router.push({ name: "Dashboard" });
    return;
  }
  columnsStore.fetchColumns();
  ordersStore.fetchOrders(selectedMonth.value);
  pendingsStore.fetchAllPendings();
});

// Actions
async function handleRecover(orderId) {
  processingId.value = orderId;
  try {
    await ordersStore.recoverOrder(orderId);
  } catch (error) {
    console.error("Failed to recover order:", error);
  } finally {
    processingId.value = null;
  }
}

function openPermanentDeleteModal(order) {
  deletingOrderId.value = order.id;
  deletingOrder.value = order;
  confirmOrderId.value = "";
  showPermanentDeleteModal.value = true;
}

function closePermanentDeleteModal() {
  showPermanentDeleteModal.value = false;
  deletingOrderId.value = null;
  deletingOrder.value = null;
  confirmOrderId.value = "";
}

async function confirmPermanentDelete() {
  if (confirmOrderId.value !== deletingOrder.value.id) {
    return;
  }

  processingId.value = deletingOrderId.value;
  try {
    await ordersStore.permanentDeleteOrder(deletingOrderId.value);
    closePermanentDeleteModal();
  } catch (error) {
    console.error("Failed to permanently delete order:", error);
  } finally {
    processingId.value = null;
  }
}

function openViewDetailsModal(order) {
  viewingOrder.value = order;
  showViewDetailsModal.value = true;
}

function closeViewDetailsModal() {
  showViewDetailsModal.value = false;
  viewingOrder.value = null;
}

function toggleSelection(orderId) {
  if (selectedOrderIds.value.has(orderId)) {
    selectedOrderIds.value.delete(orderId);
  } else {
    selectedOrderIds.value.add(orderId);
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedOrderIds.value.clear();
  } else {
    filteredDeletedOrders.value.forEach((o) =>
      selectedOrderIds.value.add(o.id),
    );
  }
}

async function handleBulkRecover() {
  if (selectedOrderIds.value.size === 0) return;

  if (
    !confirm(
      `Are you sure you want to recover ${selectedOrderIds.value.size} order(s)?`,
    )
  ) {
    return;
  }

  processingBulk.value = true;
  const orderIds = Array.from(selectedOrderIds.value);

  try {
    for (const orderId of orderIds) {
      await ordersStore.recoverOrder(orderId);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    selectedOrderIds.value.clear();
  } catch (error) {
    console.error("Failed to bulk recover:", error);
  } finally {
    processingBulk.value = false;
  }
}

function clearFilters() {
  filterMonth.value = "";
  filterDateStart.value = "";
  filterDateEnd.value = "";
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

// Get pending changes count for an order
function getPendingCount(orderId) {
  return pendingsStore.allPendingItems.filter((p) => p.targetId === orderId)
    .length;
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Deleted Orders</h2>
      <p class="text-gray-600 mt-1">
        Recover or permanently delete soft-deleted orders.
        <span class="text-sm text-red-600 font-medium ml-2">
          {{ filteredDeletedOrders.length }} deleted order{{
            filteredDeletedOrders.length !== 1 ? "s" : ""
          }}
        </span>
      </p>
    </div>

    <!-- Auto-purge notice -->
    <div class="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div class="flex items-start gap-3">
        <svg
          class="w-5 h-5 text-yellow-600 mt-0.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div class="flex-1">
          <h3 class="text-sm font-semibold text-yellow-800">
            Auto-Purge Policy
          </h3>
          <p class="text-sm text-yellow-700 mt-1">
            Orders deleted more than 30 days ago are automatically purged and
            cannot be recovered.
          </p>
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

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Month</label
          >
          <select
            v-model="filterMonth"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Months</option>
            <option
              v-for="month in availableMonths"
              :key="month"
              :value="month"
            >
              {{ month }}
            </option>
          </select>
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Deleted From</label
          >
          <input
            v-model="filterDateStart"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Deleted To</label
          >
          <input
            v-model="filterDateEnd"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex-1 min-w-[150px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Sort By</label
          >
          <select
            v-model="sortOrder"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Newest First</option>
            <option value="asc">Oldest First</option>
          </select>
        </div>
        <div class="flex items-end">
          <button
            @click="clearFilters"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Clear Filters
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="ordersStore.loading" class="text-center py-12">
      <div class="inline-flex items-center text-gray-400">
        <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Loading deleted orders...
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredDeletedOrders.length === 0"
      class="text-center py-12"
    >
      <div
        class="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4"
      >
        <svg
          class="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        No Deleted Orders
      </h2>
      <p class="text-gray-600">There are no deleted orders to display.</p>
    </div>

    <!-- Table View -->
    <div v-else class="space-y-4">
      <!-- Bulk Actions -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <input
              type="checkbox"
              :checked="allSelected"
              :indeterminate="someSelected"
              @change="toggleSelectAll"
              class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span class="text-sm text-gray-600">
              {{
                selectedOrderIds.size > 0
                  ? `${selectedOrderIds.size} selected`
                  : `${filteredDeletedOrders.length} deleted orders`
              }}
            </span>
          </div>
          <button
            @click="handleBulkRecover"
            :disabled="processingBulk || selectedOrderIds.size === 0"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingBulk">Recovering...</span>
            <span v-else>Recover Selected ({{ selectedOrderIds.size }})</span>
          </button>
        </div>
      </div>

      <!-- Table -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="w-12 px-4 py-3"></th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Order ID
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Month
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Deleted By
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Deleted At
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Auto-Purge
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Pendings
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr
                v-for="order in filteredDeletedOrders"
                :key="order.id"
                class="hover:bg-gray-50"
              >
                <td class="px-4 py-4">
                  <input
                    type="checkbox"
                    :checked="selectedOrderIds.has(order.id)"
                    @change="toggleSelection(order.id)"
                    class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900"
                >
                  {{ order.id.slice(0, 8) }}...
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ order.month }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {{ order.deletedByName || "—" }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {{ formatDate(order.deletedAt) }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                  <span :class="getPurgeWarning(order.deletedAt)?.class">
                    {{ getPurgeWarning(order.deletedAt)?.text }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <span
                    v-if="getPendingCount(order.id) > 0"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
                  >
                    {{ getPendingCount(order.id) }} pending
                  </span>
                  <span v-else class="text-gray-400">—</span>
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                >
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openViewDetailsModal(order)"
                      class="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View
                    </button>
                    <button
                      @click="handleRecover(order.id)"
                      :disabled="processingId === order.id"
                      class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span v-if="processingId === order.id"
                        >Recovering...</span
                      >
                      <span v-else>Recover</span>
                    </button>
                    <button
                      v-if="isSuperAdmin"
                      @click="openPermanentDeleteModal(order)"
                      :disabled="processingId === order.id"
                      class="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Permanent Delete Confirmation Modal -->
    <div
      v-if="showPermanentDeleteModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closePermanentDeleteModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-start gap-3 mb-4">
          <div
            class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">
              Permanent Delete Warning
            </h3>
            <p class="text-sm text-red-600 font-semibold mb-3">
              This action cannot be undone!
            </p>
            <div class="bg-gray-50 rounded-lg p-3 mb-3 text-sm space-y-1">
              <div>
                <span class="font-medium">Order ID:</span>
                {{ deletingOrder?.id }}
              </div>
              <div>
                <span class="font-medium">Month:</span>
                {{ deletingOrder?.month }}
              </div>
              <div
                v-if="getPendingCount(deletingOrder?.id) > 0"
                class="text-yellow-700"
              >
                <span class="font-medium">⚠️ Pending Changes:</span>
                {{ getPendingCount(deletingOrder?.id) }}
              </div>
            </div>
            <p class="text-sm text-gray-600 mb-3">
              To confirm, type the order ID below:
            </p>
            <input
              v-model="confirmOrderId"
              type="text"
              placeholder="Enter order ID"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
            />
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="closePermanentDeleteModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="confirmPermanentDelete"
            :disabled="
              confirmOrderId !== deletingOrder?.id ||
              processingId === deletingOrderId
            "
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingId === deletingOrderId">Deleting...</span>
            <span v-else>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>

    <!-- View Details Modal -->
    <div
      v-if="showViewDetailsModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeViewDetailsModal"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6 max-h-[80vh] overflow-y-auto"
      >
        <div class="flex items-start justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            Order Details (Read-Only)
          </h3>
          <button
            @click="closeViewDetailsModal"
            class="text-gray-400 hover:text-gray-600"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="space-y-4">
          <!-- Basic Info -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">
              Basic Information
            </h4>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span class="text-gray-500">Order ID:</span>
                <div class="font-mono text-gray-900 mt-1">
                  {{ viewingOrder?.id }}
                </div>
              </div>
              <div>
                <span class="text-gray-500">Month:</span>
                <div class="text-gray-900 mt-1">{{ viewingOrder?.month }}</div>
              </div>
              <div>
                <span class="text-gray-500">Created By:</span>
                <div class="text-gray-900 mt-1">
                  {{ viewingOrder?.createdByName || "—" }}
                </div>
              </div>
              <div>
                <span class="text-gray-500">Created At:</span>
                <div class="text-gray-900 mt-1">
                  {{ formatDate(viewingOrder?.createdAt) }}
                </div>
              </div>
              <div>
                <span class="text-gray-500">Deleted By:</span>
                <div class="text-gray-900 mt-1">
                  {{ viewingOrder?.deletedByName || "—" }}
                </div>
              </div>
              <div>
                <span class="text-gray-500">Deleted At:</span>
                <div class="text-gray-900 mt-1">
                  {{ formatDate(viewingOrder?.deletedAt) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Dynamic Fields -->
          <div class="bg-gray-50 rounded-lg p-4">
            <h4 class="text-sm font-semibold text-gray-700 mb-3">Order Data</h4>
            <div class="space-y-2 text-sm">
              <div
                v-for="(value, key) in viewingOrder?.dynamic_fields"
                :key="key"
                class="flex justify-between py-2 border-b border-gray-200 last:border-0"
              >
                <span class="text-gray-600 font-medium">{{ key }}:</span>
                <span class="text-gray-900">{{ formatValue(value) }}</span>
              </div>
              <div
                v-if="
                  !viewingOrder?.dynamic_fields ||
                  Object.keys(viewingOrder.dynamic_fields).length === 0
                "
                class="text-gray-400 text-center py-4"
              >
                No data fields
              </div>
            </div>
          </div>

          <!-- Pending Changes -->
          <div
            v-if="getPendingCount(viewingOrder?.id) > 0"
            class="bg-yellow-50 rounded-lg p-4 border border-yellow-200"
          >
            <h4 class="text-sm font-semibold text-yellow-800 mb-2">
              ⚠️ Pending Changes
            </h4>
            <p class="text-sm text-yellow-700">
              This order has {{ getPendingCount(viewingOrder?.id) }} pending
              change(s) that will be voided if permanently deleted.
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            @click="closeViewDetailsModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
