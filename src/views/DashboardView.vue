<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useRouter } from "vue-router";

const authStore = useAuthStore();
const ordersStore = useOrdersStore();
const router = useRouter();

// Default to current month in YYYY-MM format
const currentMonth = new Date().toISOString().slice(0, 7);

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

const creating = ref(false);

async function handleCreateOrder() {
  creating.value = true;
  try {
    await ordersStore.createOrder({
      dynamic_fields: {},
    });
  } catch (err) {
    // error is shown in ordersStore.error
  } finally {
    creating.value = false;
  }
}

async function handleLogout() {
  ordersStore.cleanup();
  await authStore.logout();
  router.push({ name: "Login" });
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <h1 class="text-xl font-bold text-primary-600">TM4U</h1>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm text-gray-600">
              {{ authStore.userName }}
            </span>
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
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-semibold text-gray-900">
            Orders — {{ currentMonth }}
          </h3>
          <button
            @click="handleCreateOrder"
            :disabled="creating"
            class="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {{ creating ? "Creating…" : "+ New Order" }}
          </button>
        </div>

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
