<script setup>
import { onMounted, onUnmounted, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const router = useRouter();

// Default to current month in YYYY-MM format
const currentMonth = new Date().toISOString().slice(0, 7);

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

onMounted(() => {
  ordersStore.fetchOrders(currentMonth);
});

onUnmounted(() => {
  ordersStore.cleanup();
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
        <h2 class="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p class="text-gray-600 mt-1">Welcome to the Order Management System</p>
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
            {{ currentMonth }}
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
          Orders — {{ currentMonth }}
        </h3>

        <div v-if="ordersStore.loading" class="text-gray-400 text-center py-8">
          Loading orders…
        </div>

        <div
          v-else-if="ordersStore.activeOrders.length === 0"
          class="text-gray-500 text-center py-8"
        >
          No orders for {{ currentMonth }}.
        </div>

        <table v-else class="w-full text-sm">
          <thead>
            <tr class="border-b text-left text-gray-500">
              <th class="pb-2 pr-4">ID</th>
              <th class="pb-2 pr-4">Status</th>
              <th class="pb-2 pr-4">Created By</th>
              <th class="pb-2">Created At</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="order in ordersStore.activeOrders"
              :key="order.id"
              class="border-b last:border-0 hover:bg-gray-50"
            >
              <td class="py-2 pr-4 font-mono text-xs text-gray-500">
                {{ order.id.slice(0, 8) }}…
              </td>
              <td class="py-2 pr-4">
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="{
                    'bg-green-100 text-green-700': order.status === 'active',
                    'bg-blue-100 text-blue-700': order.status === 'completed',
                    'bg-gray-100 text-gray-500': order.status === 'cancelled',
                  }"
                  >{{ order.status }}</span
                >
              </td>
              <td class="py-2 pr-4">
                {{ order.createdByName || order.createdBy }}
              </td>
              <td class="py-2 text-gray-500">
                {{
                  order.createdAt
                    ? new Date(order.createdAt).toLocaleDateString()
                    : "—"
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>
