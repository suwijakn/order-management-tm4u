<script setup>
import { onMounted, computed, watch, ref, inject } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useOrdersStore } from "@/stores/orders";
import { useColumnsStore } from "@/stores/columns";
import { usePendingsStore } from "@/stores/pendings";
import { useRouter } from "vue-router";
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

// Only Manager+ can view deleted orders
const isManagerOrAbove = computed(() => {
  return ["manager", "super_admin"].includes(authStore.userRole);
});

// Watch for month changes and refetch orders
watch(selectedMonth, (newMonth) => {
  ordersStore.fetchOrders(newMonth);
});

// Deleted orders count
const deletedCount = computed(() => ordersStore.deletedOrders.length);

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

function handleOrderUpdated(payload) {
  console.log("[DeletedOrders] Order updated:", payload);
}

function handleOrderDeleted(payload) {
  console.log("[DeletedOrders] Order deleted:", payload);
}
</script>

<template>
  <div>
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-900">Deleted Orders</h2>
      <p class="text-gray-600 mt-1">
        Recover or permanently delete orders.
        <span class="text-sm text-red-600 font-medium ml-2">
          {{ deletedCount }} deleted order{{ deletedCount !== 1 ? "s" : "" }}
        </span>
      </p>
    </div>

    <!-- Error banner -->
    <div
      v-if="ordersStore.error"
      class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm"
    >
      {{ ordersStore.error }}
    </div>

    <!-- Spreadsheet Grid with show-deleted -->
    <SpreadsheetGrid
      :month="selectedMonth"
      :show-deleted="true"
      @order-updated="handleOrderUpdated"
      @order-deleted="handleOrderDeleted"
    />
  </div>
</template>
