<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePendingsStore } from "@/stores/pendings";
import { useAuthStore } from "@/stores/auth";

const pendingsStore = usePendingsStore();
const authStore = useAuthStore();

const processingId = ref(null);
const action = ref(null);
const processingAll = ref(false);
const actionType = ref(null);

const pendingItems = computed(() => pendingsStore.pendingItems);
const pendingCount = computed(() => pendingsStore.pendingItems.length);

onMounted(() => {
  // Managers fetch all pending requests
  pendingsStore.fetchPendings(false);
});

onUnmounted(() => {
  pendingsStore.cleanup();
});

async function handleApprove(pendingId) {
  processingId.value = pendingId;
  action.value = "approve";

  try {
    await pendingsStore.approvePending(pendingId);
  } catch (error) {
    console.error("Failed to approve:", error);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function handleReject(pendingId) {
  processingId.value = pendingId;
  action.value = "reject";

  try {
    await pendingsStore.rejectPending(pendingId);
  } catch (error) {
    console.error("Failed to reject:", error);
  } finally {
    processingId.value = null;
    action.value = null;
  }
}

async function handleApproveAll() {
  if (
    !confirm(
      `Are you sure you want to approve all ${pendingCount.value} pending requests?`,
    )
  ) {
    return;
  }

  processingAll.value = true;
  actionType.value = "approve";

  try {
    // Process all pending items sequentially
    for (const pending of pendingItems.value) {
      await pendingsStore.approvePending(pending.id);
    }
  } catch (error) {
    console.error("Failed to approve all:", error);
  } finally {
    processingAll.value = false;
    actionType.value = null;
  }
}

async function handleRejectAll() {
  if (
    !confirm(
      `Are you sure you want to reject all ${pendingCount.value} pending requests?`,
    )
  ) {
    return;
  }

  processingAll.value = true;
  actionType.value = "reject";

  try {
    // Get all pending IDs first
    const pendingIds = pendingItems.value.map((p) => p.id);

    // Process all pending items sequentially
    for (const pendingId of pendingIds) {
      await pendingsStore.rejectPending(pendingId);
      // Small delay to prevent overwhelming Firestore
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">Pending Requests</h1>
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
            <router-link to="/dashboard" class="btn-secondary text-sm">
              Back to Dashboard
            </router-link>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <svg
            class="animate-spin h-5 w-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
          >
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
      <div v-else-if="pendingCount === 0" class="text-center py-12">
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
          v-if="pendingCount > 1"
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
        >
          <div class="flex items-center justify-between">
            <div class="text-sm text-gray-600">
              {{ pendingCount }} pending requests
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="handleApproveAll"
                :disabled="processingAll"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <span v-if="processingAll && actionType === 'approve'"
                  >Approving All...</span
                >
                <span v-else>Approve All</span>
              </button>
              <button
                @click="handleRejectAll"
                :disabled="processingAll"
                class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <span v-if="processingAll && actionType === 'reject'"
                  >Rejecting All...</span
                >
                <span v-else>Reject All</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Individual Requests -->
        <div
          v-for="pending in pendingItems"
          :key="pending.id"
          class="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <!-- Header -->
              <div class="flex items-center gap-3 mb-3">
                <span
                  :class="{
                    'bg-blue-100 text-blue-800':
                      pending.targetCollection === 'orders',
                    'bg-purple-100 text-purple-800':
                      pending.targetCollection === 'costs',
                  }"
                  class="px-2 py-1 rounded text-xs font-medium"
                >
                  {{ pending.targetCollection === "orders" ? "Order" : "Cost" }}
                </span>
                <span class="text-sm text-gray-500">
                  {{ pending.targetId.slice(0, 8) }}...
                </span>
                <span class="text-sm font-medium text-gray-900">
                  {{ pending.field }}
                </span>
              </div>

              <!-- Change Details -->
              <div class="bg-gray-50 rounded-lg p-4 mb-3">
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <div class="text-xs text-gray-500 mb-1">Current Value</div>
                    <div class="text-sm font-medium text-gray-900">
                      {{ formatValue(pending.baseValue) }}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs text-gray-500 mb-1">Proposed Value</div>
                    <div class="text-sm font-medium text-primary-600">
                      {{ formatValue(pending.newValue) }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Request Info -->
              <div class="flex items-center gap-4 text-sm text-gray-500">
                <div class="flex items-center gap-1">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <span>{{ pending.requestedByName }}</span>
                </div>
                <div class="flex items-center gap-1">
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
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{{ formatDate(pending.requestedAt) }}</span>
                </div>
                <div class="flex items-center gap-1">
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
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{{ pending.orderMonth }}</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 ml-4">
              <button
                @click="handleReject(pending.id)"
                :disabled="processingId === pending.id"
                class="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <span v-if="processingId === pending.id && action === 'reject'"
                  >Rejecting...</span
                >
                <span v-else>Reject</span>
              </button>
              <button
                @click="handleApprove(pending.id)"
                :disabled="processingId === pending.id"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <span v-if="processingId === pending.id && action === 'approve'"
                  >Approving...</span
                >
                <span v-else>Approve</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
