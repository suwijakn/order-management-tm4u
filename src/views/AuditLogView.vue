<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/services/firebase";
import { useAuthStore } from "@/stores/auth";

const router = useRouter();
const authStore = useAuthStore();

// Only Super Admin can access
const isSuperAdmin = computed(() => authStore.userRole === "super_admin");

// State
const logs = ref([]);
const loading = ref(false);
const hasMore = ref(true);
const lastDoc = ref(null);

// Filters
const filterUser = ref("");
const filterAction = ref("");
const filterTargetId = ref("");
const filterDateFrom = ref("");
const filterDateTo = ref("");

// Real-time listener
let unsubscribe = null;

// Available actions for filter dropdown
const actionTypes = [
  { value: "", label: "All Actions" },
  { value: "order_create", label: "Order Create" },
  { value: "order_update", label: "Order Update" },
  { value: "order_delete", label: "Order Delete" },
  { value: "order_recover", label: "Order Recover" },
  { value: "order_permanent_delete", label: "Order Permanent Delete" },
  { value: "cost_create", label: "Cost Create" },
  { value: "cost_update", label: "Cost Update" },
  { value: "cost_delete", label: "Cost Delete" },
  { value: "pending_create", label: "Pending Create" },
  { value: "pending_approve", label: "Pending Approve" },
  { value: "pending_reject", label: "Pending Reject" },
  { value: "pending_withdraw", label: "Pending Withdraw" },
  { value: "pending_auto_expire", label: "Pending Auto Expire" },
  { value: "column_create", label: "Column Create" },
  { value: "column_update", label: "Column Update" },
  { value: "column_delete", label: "Column Delete" },
  { value: "column_reorder", label: "Column Reorder" },
  { value: "column_clear_data", label: "Column Clear Data" },
];

// Color coding for action types
const actionColors = {
  order_create: "bg-green-100 text-green-800",
  order_update: "bg-blue-100 text-blue-800",
  order_delete: "bg-red-100 text-red-800",
  order_recover: "bg-purple-100 text-purple-800",
  order_permanent_delete: "bg-red-200 text-red-900",
  cost_create: "bg-green-100 text-green-800",
  cost_update: "bg-blue-100 text-blue-800",
  cost_delete: "bg-red-100 text-red-800",
  pending_create: "bg-yellow-100 text-yellow-800",
  pending_approve: "bg-green-100 text-green-800",
  pending_reject: "bg-red-100 text-red-800",
  pending_withdraw: "bg-gray-100 text-gray-800",
  pending_auto_expire: "bg-orange-100 text-orange-800",
  column_create: "bg-indigo-100 text-indigo-800",
  column_update: "bg-indigo-100 text-indigo-800",
  column_delete: "bg-red-100 text-red-800",
  column_reorder: "bg-indigo-100 text-indigo-800",
  column_clear_data: "bg-orange-100 text-orange-800",
  default: "bg-gray-100 text-gray-800",
};

function getActionColor(action) {
  return actionColors[action] || actionColors.default;
}

// Filtered logs
const filteredLogs = computed(() => {
  let result = [...logs.value];

  if (filterUser.value) {
    const searchTerm = filterUser.value.toLowerCase();
    result = result.filter(
      (log) =>
        log.userName?.toLowerCase().includes(searchTerm) ||
        log.userId?.toLowerCase().includes(searchTerm)
    );
  }

  if (filterTargetId.value) {
    const searchTerm = filterTargetId.value.toLowerCase();
    result = result.filter((log) =>
      log.targetId?.toLowerCase().includes(searchTerm)
    );
  }

  return result;
});

// Fetch logs with real-time updates
function fetchLogs() {
  if (!isSuperAdmin.value) {
    router.push({ name: "Dashboard" });
    return;
  }

  loading.value = true;

  // Build query
  let q = query(
    collection(db, "audit_logs"),
    orderBy("timestamp", "desc"),
    limit(50)
  );

  // Add action filter if set
  if (filterAction.value) {
    q = query(
      collection(db, "audit_logs"),
      where("action", "==", filterAction.value),
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }

  // Add date filters if set
  if (filterDateFrom.value) {
    const fromDate = new Date(filterDateFrom.value);
    fromDate.setHours(0, 0, 0, 0);
    q = query(
      collection(db, "audit_logs"),
      where("timestamp", ">=", Timestamp.fromDate(fromDate)),
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }

  if (filterDateTo.value) {
    const toDate = new Date(filterDateTo.value);
    toDate.setHours(23, 59, 59, 999);
    q = query(
      collection(db, "audit_logs"),
      where("timestamp", "<=", Timestamp.fromDate(toDate)),
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }

  // Subscribe to real-time updates
  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      logs.value = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate?.() || null,
        };
      });

      hasMore.value = snapshot.docs.length === 50;
      lastDoc.value = snapshot.docs[snapshot.docs.length - 1] || null;
      loading.value = false;
    },
    (err) => {
      console.error("[AuditLogView] Error fetching logs:", err);
      loading.value = false;
    }
  );
}

// Load more logs (infinite scroll)
async function loadMore() {
  if (!hasMore.value || loading.value || !lastDoc.value) return;

  loading.value = true;

  let q = query(
    collection(db, "audit_logs"),
    orderBy("timestamp", "desc"),
    startAfter(lastDoc.value),
    limit(50)
  );

  if (filterAction.value) {
    q = query(
      collection(db, "audit_logs"),
      where("action", "==", filterAction.value),
      orderBy("timestamp", "desc"),
      startAfter(lastDoc.value),
      limit(50)
    );
  }

  // Note: For infinite scroll, we use getDocs instead of onSnapshot
  const { getDocs } = await import("firebase/firestore");
  const snapshot = await getDocs(q);

  const moreLogs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() || null,
    };
  });

  logs.value = [...logs.value, ...moreLogs];
  hasMore.value = snapshot.docs.length === 50;
  lastDoc.value = snapshot.docs[snapshot.docs.length - 1] || null;
  loading.value = false;
}

// Export to CSV
function exportToCSV() {
  const headers = [
    "Timestamp",
    "User",
    "User ID",
    "Action",
    "Collection",
    "Target ID",
    "Details",
  ];

  const rows = filteredLogs.value.map((log) => [
    log.timestamp?.toISOString() || "",
    log.userName || "",
    log.userId || "",
    log.action || "",
    log.targetCollection || "",
    log.targetId || "",
    JSON.stringify(log.details || {}),
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    `audit_logs_${new Date().toISOString().split("T")[0]}.csv`
  );
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Clear filters
function clearFilters() {
  filterUser.value = "";
  filterAction.value = "";
  filterTargetId.value = "";
  filterDateFrom.value = "";
  filterDateTo.value = "";
  fetchLogs();
}

// Format timestamp
function formatTimestamp(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

// Format details object
function formatDetails(details) {
  if (!details || Object.keys(details).length === 0) return "-";
  return JSON.stringify(details, null, 2);
}

// Watch for filter changes
watch([filterAction, filterDateFrom, filterDateTo], () => {
  fetchLogs();
});

// Lifecycle
onMounted(() => {
  if (!isSuperAdmin.value) {
    router.push({ name: "Dashboard" });
    return;
  }
  fetchLogs();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<template>
  <div class="p-6 max-w-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p class="text-sm text-gray-500 mt-1">
          View all system activity (Super Admin only)
        </p>
      </div>
      <button
        @click="exportToCSV"
        class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Export CSV
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <!-- User Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">User</label>
          <input
            v-model="filterUser"
            type="text"
            placeholder="Search by name or ID"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Action Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Action</label>
          <select
            v-model="filterAction"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option v-for="action in actionTypes" :key="action.value" :value="action.value">
              {{ action.label }}
            </option>
          </select>
        </div>

        <!-- Target ID Filter -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Target ID</label>
          <input
            v-model="filterTargetId"
            type="text"
            placeholder="Search by target ID"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Date From -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            v-model="filterDateFrom"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <!-- Date To -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            v-model="filterDateTo"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      <div class="mt-3 flex justify-end">
        <button
          @click="clearFilters"
          class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
        >
          Clear Filters
        </button>
      </div>
    </div>

    <!-- Results Count -->
    <div class="mb-4 text-sm text-gray-600">
      Showing {{ filteredLogs.length }} log entries
    </div>

    <!-- Loading State -->
    <div v-if="loading && logs.length === 0" class="text-center py-12">
      <div class="inline-flex items-center text-gray-400">
        <svg class="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Loading audit logs...
      </div>
    </div>

    <!-- Logs Table -->
    <div v-else class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                User
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Collection
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Target ID
              </th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="log in filteredLogs"
              :key="log.id"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                {{ formatTimestamp(log.timestamp) }}
              </td>
              <td class="px-4 py-3 text-sm">
                <div class="font-medium text-gray-900">{{ log.userName || "-" }}</div>
                <div class="text-xs text-gray-500">{{ log.userRole || "-" }}</div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <span
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded-full',
                    getActionColor(log.action),
                  ]"
                >
                  {{ log.action?.replace(/_/g, " ") || "-" }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                {{ log.targetCollection || "-" }}
              </td>
              <td class="px-4 py-3 text-sm font-mono text-gray-600">
                <span class="truncate max-w-[150px] inline-block" :title="log.targetId">
                  {{ log.targetId || "-" }}
                </span>
              </td>
              <td class="px-4 py-3 text-sm text-gray-600">
                <details v-if="log.details && Object.keys(log.details).length > 0" class="cursor-pointer">
                  <summary class="text-blue-600 hover:text-blue-800">View Details</summary>
                  <pre class="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-w-xs">{{ formatDetails(log.details) }}</pre>
                </details>
                <span v-else class="text-gray-400">-</span>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="filteredLogs.length === 0 && !loading">
              <td colspan="6" class="px-4 py-12 text-center text-gray-500">
                No audit logs found matching your filters.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Load More -->
      <div v-if="hasMore && filteredLogs.length > 0" class="p-4 text-center border-t">
        <button
          @click="loadMore"
          :disabled="loading"
          class="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <span v-if="loading">Loading...</span>
          <span v-else>Load More</span>
        </button>
      </div>
    </div>
  </div>
</template>
