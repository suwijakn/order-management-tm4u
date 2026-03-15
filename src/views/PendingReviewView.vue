<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePendingsStore } from "@/stores/pendings";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useRouter } from "vue-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/services/firebase";

const pendingsStore = usePendingsStore();
const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const router = useRouter();

const processingId = ref(null);
const action = ref(null);
const processingAll = ref(false);
const actionType = ref(null);

// Rejection comment modal state
const showRejectModal = ref(false);
const rejectingPendingId = ref(null);
const rejectionComment = ref("");

// BaseValue warning modal state
const showBaseValueWarning = ref(false);
const warningPendingId = ref(null);
const warningCurrentValue = ref(null);
const warningBaseValue = ref(null);

// Filters
const selectedStatus = ref("pending");
const selectedRequester = ref("");
const dateRangeStart = ref("");
const dateRangeEnd = ref("");

// Bulk selection
const selectedPendingIds = ref(new Set());

const pendingItems = computed(() => pendingsStore.pendingItems);
const pendingCount = computed(() => pendingsStore.pendingItems.length);

// Group pendings by order
const groupedPendings = computed(() => {
  const groups = {};
  const filtered = filteredPendingItems.value;

  filtered.forEach((pending) => {
    const key = `${pending.targetId}_${pending.orderMonth}`;
    if (!groups[key]) {
      groups[key] = {
        targetId: pending.targetId,
        orderMonth: pending.orderMonth,
        targetCollection: pending.targetCollection,
        pendings: [],
      };
    }
    groups[key].pendings.push(pending);
  });

  return Object.values(groups);
});

// Filtered pending items based on filters
const filteredPendingItems = computed(() => {
  let items = pendingItems.value;

  // Filter by requester
  if (selectedRequester.value) {
    items = items.filter((p) => p.requestedBy === selectedRequester.value);
  }

  // Filter by date range
  if (dateRangeStart.value) {
    const startDate = new Date(dateRangeStart.value);
    items = items.filter((p) => new Date(p.requestedAt) >= startDate);
  }
  if (dateRangeEnd.value) {
    const endDate = new Date(dateRangeEnd.value);
    endDate.setHours(23, 59, 59, 999);
    items = items.filter((p) => new Date(p.requestedAt) <= endDate);
  }

  return items;
});

// Get unique requesters for filter dropdown
const uniqueRequesters = computed(() => {
  const requesters = new Map();
  pendingItems.value.forEach((p) => {
    if (!requesters.has(p.requestedBy)) {
      requesters.set(p.requestedBy, p.requestedByName);
    }
  });
  return Array.from(requesters.entries()).map(([id, name]) => ({ id, name }));
});

// Check if all visible pendings are selected
const allSelected = computed(() => {
  if (filteredPendingItems.value.length === 0) return false;
  return filteredPendingItems.value.every((p) =>
    selectedPendingIds.value.has(p.id),
  );
});

// Check if some (but not all) are selected
const someSelected = computed(() => {
  return selectedPendingIds.value.size > 0 && !allSelected.value;
});

onMounted(() => {
  // Managers fetch all pending requests
  pendingsStore.fetchPendings(false);
});

onUnmounted(() => {
  // Store cleanup is handled at the layout level, not per-view
});

async function handleApprove(pendingId) {
  // Check if baseValue has changed
  const pending = pendingItems.value.find((p) => p.id === pendingId);
  if (!pending) return;

  try {
    // Fetch current order value
    const orderDoc = await getDoc(
      doc(db, pending.targetCollection, pending.targetId),
    );
    if (orderDoc.exists()) {
      const orderData = orderDoc.data();
      const field = pending.field.replace("dynamic_fields.", "");
      const currentValue = orderData.dynamic_fields?.[field];

      // Check if baseValue has changed since request
      if (currentValue !== pending.baseValue) {
        // Show warning modal
        warningPendingId.value = pendingId;
        warningCurrentValue.value = currentValue;
        warningBaseValue.value = pending.baseValue;
        showBaseValueWarning.value = true;
        return;
      }
    }
  } catch (error) {
    console.error("Failed to check baseValue:", error);
  }

  // Proceed with approval
  await proceedWithApproval(pendingId);
}

async function proceedWithApproval(pendingId) {
  processingId.value = pendingId;
  action.value = "approve";

  try {
    await pendingsStore.approvePending(pendingId);
    closeBaseValueWarning();
  } catch (error) {
    console.error("Failed to approve:", error);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

function closeBaseValueWarning() {
  showBaseValueWarning.value = false;
  warningPendingId.value = null;
  warningCurrentValue.value = null;
  warningBaseValue.value = null;
}

// Open rejection modal
function openRejectModal(pendingId) {
  rejectingPendingId.value = pendingId;
  rejectionComment.value = "";
  showRejectModal.value = true;
}

// Close rejection modal
function closeRejectModal() {
  showRejectModal.value = false;
  rejectingPendingId.value = null;
  rejectionComment.value = "";
}

// Confirm rejection with comment
async function confirmReject() {
  if (!rejectingPendingId.value) return;

  processingId.value = rejectingPendingId.value;
  action.value = "reject";

  try {
    await pendingsStore.rejectPending(
      rejectingPendingId.value,
      rejectionComment.value,
    );
    closeRejectModal();
  } catch (error) {
    console.error("Failed to reject:", error);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function handleReject(pendingId) {
  openRejectModal(pendingId);
}

async function handleApproveAll() {
  const itemsToApprove =
    selectedPendingIds.value.size > 0
      ? Array.from(selectedPendingIds.value)
      : filteredPendingItems.value.map((p) => p.id);

  if (
    !confirm(
      `Are you sure you want to approve ${itemsToApprove.length} pending request(s)?`,
    )
  ) {
    return;
  }

  processingAll.value = true;
  actionType.value = "approve";

  try {
    // Process all pending items sequentially
    for (const pendingId of itemsToApprove) {
      await pendingsStore.approvePending(pendingId);
    }
    selectedPendingIds.value.clear();
  } catch (error) {
    console.error("Failed to approve all:", error);
  } finally {
    processingAll.value = false;
    actionType.value = null;
  }
}

async function handleRejectAll() {
  const itemsToReject =
    selectedPendingIds.value.size > 0
      ? Array.from(selectedPendingIds.value)
      : filteredPendingItems.value.map((p) => p.id);

  if (
    !confirm(
      `Are you sure you want to reject ${itemsToReject.length} pending request(s)?`,
    )
  ) {
    return;
  }

  processingAll.value = true;
  actionType.value = "reject";

  try {
    // Process all pending items sequentially
    for (const pendingId of itemsToReject) {
      await pendingsStore.rejectPending(pendingId);
      // Small delay to prevent overwhelming Firestore
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    selectedPendingIds.value.clear();
  } catch (error) {
    console.error("Failed to reject all:", error);
    // Refresh the data if there was an error
    pendingsStore.fetchPendings(false);
  } finally {
    processingAll.value = false;
    actionType.value = null;
  }
}

function formatValue(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date).toLocaleString();
}

function getExpirationInfo(expiresAt) {
  if (!expiresAt) return { text: "No expiration", class: "text-gray-500" };

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: "Expired", class: "text-red-600 font-semibold" };
  } else if (diffDays === 0) {
    return { text: "Expires today", class: "text-red-600 font-semibold" };
  } else if (diffDays === 1) {
    return { text: "Expires in 1 day", class: "text-orange-600 font-semibold" };
  } else if (diffDays <= 3) {
    return { text: `Expires in ${diffDays} days`, class: "text-orange-600" };
  } else {
    return { text: `Expires in ${diffDays} days`, class: "text-gray-600" };
  }
}

function toggleSelection(pendingId) {
  if (selectedPendingIds.value.has(pendingId)) {
    selectedPendingIds.value.delete(pendingId);
  } else {
    selectedPendingIds.value.add(pendingId);
  }
}

function toggleSelectAll() {
  if (allSelected.value) {
    selectedPendingIds.value.clear();
  } else {
    filteredPendingItems.value.forEach((p) =>
      selectedPendingIds.value.add(p.id),
    );
  }
}

function clearFilters() {
  selectedRequester.value = "";
  dateRangeStart.value = "";
  dateRangeEnd.value = "";
}

function viewOrder(orderMonth, targetId) {
  // Navigate to dashboard with the order's month and scroll to order
  router.push({
    name: "Dashboard",
    query: { month: orderMonth, orderId: targetId },
  });
}
</script>

<template>
  <div>
    <!-- Header -->
    <div class="mb-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">Pending Requests</h2>
          <p class="text-gray-600 mt-1">
            Review and approve/reject change requests
          </p>
        </div>
        <div class="flex items-center gap-4">
          <span
            v-if="pendingCount > 0"
            class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800"
          >
            {{ pendingCount }} pending
          </span>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >Requester</label
          >
          <select
            v-model="selectedRequester"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Requesters</option>
            <option
              v-for="req in uniqueRequesters"
              :key="req.id"
              :value="req.id"
            >
              {{ req.name }}
            </option>
          </select>
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >From Date</label
          >
          <input
            v-model="dateRangeStart"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex-1 min-w-[200px]">
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >To Date</label
          >
          <input
            v-model="dateRangeEnd"
            type="date"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

    <!-- Content -->
    <!-- Error Banner -->
    <div
      v-if="pendingsStore.error"
      class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ pendingsStore.error }}
    </div>

    <!-- Loading State -->
    <div v-if="pendingsStore.loading" class="text-center py-12">
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
        Loading pending requests...
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredPendingItems.length === 0"
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
      <h2 class="text-xl font-semibold text-gray-900 mb-2">All Caught Up!</h2>
      <p class="text-gray-600">No pending requests to review.</p>
    </div>

    <!-- Pending List -->
    <div v-else class="space-y-4">
      <!-- Bulk Actions -->
      <div
        v-if="filteredPendingItems.length > 0"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
      >
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
                selectedPendingIds.size > 0
                  ? `${selectedPendingIds.size} selected`
                  : `${filteredPendingItems.length} pending requests`
              }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="handleApproveAll"
              :disabled="
                processingAll ||
                (selectedPendingIds.size === 0 &&
                  filteredPendingItems.length === 0)
              "
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <span v-if="processingAll && actionType === 'approve'"
                >Approving...</span
              >
              <span v-else>{{
                selectedPendingIds.size > 0
                  ? `Approve Selected (${selectedPendingIds.size})`
                  : "Approve All"
              }}</span>
            </button>
            <button
              @click="handleRejectAll"
              :disabled="
                processingAll ||
                (selectedPendingIds.size === 0 &&
                  filteredPendingItems.length === 0)
              "
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <span v-if="processingAll && actionType === 'reject'"
                >Rejecting...</span
              >
              <span v-else>{{
                selectedPendingIds.size > 0
                  ? `Reject Selected (${selectedPendingIds.size})`
                  : "Reject All"
              }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Grouped by Order -->
      <div
        v-for="group in groupedPendings"
        :key="`${group.targetId}_${group.orderMonth}`"
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <!-- Group Header -->
        <div
          class="flex items-center justify-between mb-4 pb-3 border-b border-gray-200"
        >
          <div class="flex items-center gap-3">
            <span
              :class="{
                'bg-blue-100 text-blue-800':
                  group.targetCollection === 'orders',
                'bg-purple-100 text-purple-800':
                  group.targetCollection === 'costs',
              }"
              class="px-2 py-1 rounded text-xs font-medium"
            >
              {{ group.targetCollection === "orders" ? "Order" : "Cost" }}
            </span>
            <span class="text-sm font-semibold text-gray-900">
              ID: {{ group.targetId.slice(0, 8) }}...
            </span>
            <span class="text-sm text-gray-600">
              Month: {{ group.orderMonth }}
            </span>
            <span
              class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
            >
              {{ group.pendings.length }} change{{
                group.pendings.length > 1 ? "s" : ""
              }}
            </span>
          </div>
          <button
            @click="viewOrder(group.orderMonth, group.targetId)"
            class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            View Order
          </button>
        </div>

        <!-- Individual Pendings in Group -->
        <div class="space-y-3">
          <div
            v-for="pending in group.pendings"
            :key="pending.id"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  :checked="selectedPendingIds.has(pending.id)"
                  @change="toggleSelection(pending.id)"
                  class="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div class="flex-1">
                  <!-- Field Header -->
                  <div class="flex items-center gap-3 mb-3">
                    <span class="text-sm font-medium text-gray-900">
                      {{ pending.field }}
                    </span>
                    <span
                      v-if="pending.rejectionCount > 0"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
                      :title="`Rejected ${pending.rejectionCount} time(s)`"
                    >
                      ❌ {{ pending.rejectionCount }}
                    </span>
                    <span
                      :class="getExpirationInfo(pending.expiresAt).class"
                      class="text-xs"
                    >
                      {{ getExpirationInfo(pending.expiresAt).text }}
                    </span>
                  </div>

                  <!-- Change Details -->
                  <div class="bg-gray-50 rounded-lg p-3 mb-3">
                    <div class="grid grid-cols-2 gap-4">
                      <div>
                        <div class="text-xs text-gray-500 mb-1">Base Value</div>
                        <div class="text-sm font-medium text-gray-900">
                          {{ formatValue(pending.baseValue) }}
                        </div>
                      </div>
                      <div>
                        <div class="text-xs text-gray-500 mb-1">
                          Proposed Value
                        </div>
                        <div class="text-sm font-medium text-blue-600">
                          {{ formatValue(pending.newValue) }}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Request Info -->
                  <div class="flex items-center gap-4 text-xs text-gray-500">
                    <div class="flex items-center gap-1">
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                      <span>{{ pending.requestedByName }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <svg
                        class="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>{{ formatDate(pending.requestedAt) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="flex items-center gap-2">
                <button
                  @click="handleReject(pending.id)"
                  :disabled="processingId === pending.id"
                  class="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <span
                    v-if="processingId === pending.id && action === 'reject'"
                    >Rejecting...</span
                  >
                  <span v-else>Reject</span>
                </button>
                <button
                  @click="handleApprove(pending.id)"
                  :disabled="processingId === pending.id"
                  class="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <span
                    v-if="processingId === pending.id && action === 'approve'"
                    >Approving...</span
                  >
                  <span v-else>Approve</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- BaseValue Warning Modal -->
    <div
      v-if="showBaseValueWarning"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeBaseValueWarning"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-start gap-3 mb-4">
          <div
            class="flex-shrink-0 w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center"
          >
            <svg
              class="w-6 h-6 text-yellow-600"
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
              Order Value Changed
            </h3>
            <p class="text-sm text-gray-600 mb-4">
              The order has been modified since this change was requested.
            </p>
            <div class="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
              <div>
                <span class="font-medium text-gray-700"
                  >Base value (when requested):</span
                >
                <span class="ml-2 text-gray-900">{{
                  formatValue(warningBaseValue)
                }}</span>
              </div>
              <div>
                <span class="font-medium text-gray-700">Current value:</span>
                <span class="ml-2 text-blue-600 font-semibold">{{
                  formatValue(warningCurrentValue)
                }}</span>
              </div>
            </div>
            <p class="text-sm text-gray-600 mt-3">
              Do you still want to approve this change?
            </p>
          </div>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="closeBaseValueWarning"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="proceedWithApproval(warningPendingId)"
            :disabled="processingId === warningPendingId"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingId === warningPendingId">Approving...</span>
            <span v-else>Approve Anyway</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Rejection Comment Modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click.self="closeRejectModal"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          Reject Change Request
        </h3>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Rejection Comment (optional)
          </label>
          <textarea
            v-model="rejectionComment"
            rows="3"
            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            placeholder="Provide a reason for rejection..."
          ></textarea>
        </div>

        <div class="flex justify-end gap-3">
          <button
            @click="closeRejectModal"
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            @click="confirmReject"
            :disabled="processingId === rejectingPendingId"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <span v-if="processingId === rejectingPendingId">Rejecting...</span>
            <span v-else>Confirm Reject</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
