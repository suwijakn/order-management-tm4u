<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOrdersStore } from '@/stores/orders'
import { useColumnsStore } from '@/stores/columns'
import { usePendingsStore } from '@/stores/pendings'
import SpreadsheetCell from './SpreadsheetCell.vue'
import CostRow from './CostRow.vue'
import AddRowButton from './AddRowButton.vue'
import DeleteRowConfirm from './DeleteRowConfirm.vue'
import SkeletonLoader from '@/components/SkeletonLoader.vue'

const props = defineProps({
  month: {
    type: String,
    required: true,
  },
  showDeleted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['order-updated', 'order-created', 'order-deleted'])

const authStore = useAuthStore()
const ordersStore = useOrdersStore()
const columnsStore = useColumnsStore()
const pendingsStore = usePendingsStore()

// Local state
const highlightedCells = ref(new Set()) // Track cells that were recently changed
const deleteConfirmRefs = ref({})

// Role checks
const isManagerOrAbove = computed(() => 
  ['manager', 'super_admin'].includes(authStore.userRole)
)

// Get visible columns for current user's role
const visibleColumns = computed(() => {
  const role = authStore.userRole
  return columnsStore.visibleColumns(role)
})

// Get orders based on showDeleted prop
const orders = computed(() => {
  if (props.showDeleted) {
    return ordersStore.deletedOrders
  }
  return ordersStore.activeOrders
})

// Cost data for the current month (Manager+ only)
const costData = computed(() => {
  if (!isManagerOrAbove.value) return null
  // TODO: Implement costs store and fetch cost data
  return null
})

// Get all pending changes for display
const allPendingChanges = computed(() => pendingsStore.allPendingItems)

// Get pending change for a specific order and field
function getPendingForField(orderId, fieldKey) {
  return allPendingChanges.value.find(p => {
    if (p.targetId !== orderId) return false
    const pendingField = p.field
    const normalizedPendingField = pendingField.replace('dynamic_fields.', '')
    return pendingField === fieldKey || normalizedPendingField === fieldKey
  }) || null
}

// Check if a field is locked by another user's pending
function isFieldLocked(orderId, fieldKey) {
  const pending = getPendingForField(orderId, fieldKey)
  if (!pending) return false
  return pending.requestedBy !== authStore.user?.uid
}

// Get who locked the field
function getLockedBy(orderId, fieldKey) {
  const pending = getPendingForField(orderId, fieldKey)
  return pending?.requestedByName || null
}

// Check if order has any pending changes
function orderHasPendingChanges(orderId) {
  return allPendingChanges.value.some(p => p.targetId === orderId && p.status === 'pending')
}

// Get permission for a column
function getColumnPermission(columnKey) {
  const role = authStore.userRole
  return columnsStore.getPermission(role, columnKey)
}

// Get value from order (handles dynamic_fields)
function getOrderFieldValue(order, fieldKey) {
  // Check direct property first
  if (order[fieldKey] !== undefined) {
    return order[fieldKey]
  }
  // Check dynamic_fields
  if (order.dynamic_fields?.[fieldKey] !== undefined) {
    return order.dynamic_fields[fieldKey]
  }
  return null
}

// Handle cell save (direct update without approval)
async function handleCellSave({ field, value, previousValue, orderId }) {
  const order = orders.value.find(o => o.id === orderId)
  if (!order) return

  try {
    // T-DATA-001: Version conflict detection
    await ordersStore.updateOrder(orderId, {
      [field]: value,
    }, order.version)

    // Highlight the cell briefly
    highlightCell(orderId, field)

    emit('order-updated', { orderId, field, value, previousValue })
  } catch (err) {
    console.error('[SpreadsheetGrid] Update failed:', err)
    // TODO: Show merge dialog if version conflict
  }
}

// Handle pending created
function handlePendingCreated({ field, newValue, orderId }) {
  // Highlight the cell to show pending was created
  highlightCell(orderId, field)
}

// Highlight a cell briefly after change
function highlightCell(orderId, field) {
  const key = `${orderId}_${field}`
  highlightedCells.value.add(key)
  setTimeout(() => {
    highlightedCells.value.delete(key)
  }, 2000)
}

// Check if cell should be highlighted
function isCellHighlighted(orderId, field) {
  return highlightedCells.value.has(`${orderId}_${field}`)
}

// Handle add row
async function handleAddRow() {
  try {
    const newOrderId = await ordersStore.createOrder({
      month: props.month,
      status: 'active',
      dynamic_fields: {},
    })
    emit('order-created', { orderId: newOrderId })
  } catch (err) {
    console.error('[SpreadsheetGrid] Create order failed:', err)
  }
}

// Handle delete confirmation
function handleDeleteConfirm({ orderId, forceDelete }) {
  ordersStore.softDeleteOrder(orderId, forceDelete)
    .then(() => {
      emit('order-deleted', { orderId })
    })
    .catch(err => {
      console.error('[SpreadsheetGrid] Delete failed:', err)
    })
}

// Handle recover
function handleRecover({ orderId }) {
  ordersStore.recoverOrder(orderId)
    .then(() => {
      emit('order-updated', { orderId, recovered: true })
    })
    .catch(err => {
      console.error('[SpreadsheetGrid] Recover failed:', err)
    })
}

// Handle permanent delete
function handlePermanentDelete({ orderId }) {
  ordersStore.permanentDeleteOrder(orderId)
    .then(() => {
      emit('order-deleted', { orderId, permanent: true })
    })
    .catch(err => {
      console.error('[SpreadsheetGrid] Permanent delete failed:', err)
    })
}

// Loading state
const isLoading = computed(() => ordersStore.loading || columnsStore.loading)
</script>

<template>
  <div class="spreadsheet-grid">
    <!-- Toolbar -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-4">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ showDeleted ? 'Deleted Orders' : 'Orders' }} — {{ month }}
        </h3>
        <span class="text-sm text-gray-500">
          {{ orders.length }} {{ orders.length === 1 ? 'row' : 'rows' }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <AddRowButton
          v-if="!showDeleted"
          :disabled="isLoading"
          @add="handleAddRow"
        />
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="bg-white rounded-lg shadow p-6">
      <SkeletonLoader type="table" :lines="5" />
    </div>

    <!-- No columns -->
    <div
      v-else-if="visibleColumns.length === 0"
      class="bg-white rounded-lg shadow p-8 text-center"
    >
      <svg class="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
      </svg>
      <p class="text-gray-500">No columns are visible for your role.</p>
      <p class="text-sm text-gray-400 mt-1">Contact your administrator to configure permissions.</p>
    </div>

    <!-- No orders -->
    <div
      v-else-if="orders.length === 0"
      class="bg-white rounded-lg shadow p-8 text-center"
    >
      <svg class="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p class="text-gray-500">
        {{ showDeleted ? 'No deleted orders found.' : `No orders for ${month}.` }}
      </p>
      <p v-if="!showDeleted" class="text-sm text-gray-400 mt-1">
        Click "Add Row" to create a new order.
      </p>
    </div>

    <!-- Spreadsheet table -->
    <div v-else class="bg-white rounded-lg shadow overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-200">
            <tr>
              <!-- Row label column (for cost row alignment) -->
              <th class="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
                Type
              </th>
              <!-- ID column -->
              <th class="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <!-- Dynamic columns -->
              <th
                v-for="col in visibleColumns"
                :key="col.key"
                class="py-3 px-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
              >
                <div class="flex items-center gap-1">
                  {{ col.label }}
                  <!-- Approval required indicator -->
                  <span
                    v-if="getColumnPermission(col.key).requiresApproval"
                    class="w-1.5 h-1.5 bg-orange-400 rounded-full"
                    title="Changes require approval"
                  />
                </div>
              </th>
              <!-- Actions column -->
              <th class="py-3 px-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <!-- Order rows -->
            <tr
              v-for="order in orders"
              :key="order.id"
              :class="{
                'bg-red-50': showDeleted,
                'hover:bg-gray-50': !showDeleted,
              }"
            >
              <!-- Row type label -->
              <td class="py-2 px-3 text-xs text-gray-500 whitespace-nowrap sticky left-0 z-10"
                  :class="showDeleted ? 'bg-red-50' : 'bg-white'">
                <span v-if="showDeleted" class="text-red-500 font-medium">Deleted</span>
                <span v-else class="text-gray-400">Order</span>
              </td>

              <!-- ID column -->
              <td class="py-2 px-3 font-mono text-xs text-gray-500">
                {{ order.id.slice(0, 8) }}…
              </td>

              <!-- Dynamic columns -->
              <td
                v-for="col in visibleColumns"
                :key="col.key"
                class="p-0"
              >
                <SpreadsheetCell
                  :value="getOrderFieldValue(order, col.key)"
                  :column-key="col.key"
                  :column-type="col.type || 'text'"
                  :column-options="col.options || []"
                  :order-id="order.id"
                  :order-version="order.version || 1"
                  :order-month="order.month || month"
                  :is-editable="!showDeleted && getColumnPermission(col.key).editable"
                  :requires-approval="getColumnPermission(col.key).requiresApproval"
                  :pending-change="getPendingForField(order.id, col.key)"
                  :is-locked="isFieldLocked(order.id, col.key)"
                  :locked-by="getLockedBy(order.id, col.key)"
                  :is-cost-row="false"
                  :highlight-change="isCellHighlighted(order.id, col.key)"
                  @save="(payload) => handleCellSave({ ...payload, orderId: order.id })"
                  @pending-created="(payload) => handlePendingCreated({ ...payload, orderId: order.id })"
                />
              </td>

              <!-- Actions column -->
              <td class="py-2 px-3 text-right">
                <DeleteRowConfirm
                  :ref="el => deleteConfirmRefs[order.id] = el"
                  :order-id="order.id"
                  :order-label="getOrderFieldValue(order, 'customer_name') || order.id"
                  :has-pending-changes="orderHasPendingChanges(order.id)"
                  :is-deleted="showDeleted"
                  @confirm="handleDeleteConfirm"
                  @recover="handleRecover"
                  @permanent-delete="handlePermanentDelete"
                />
              </td>
            </tr>

            <!-- Cost row (Manager+ only) -->
            <CostRow
              v-if="!showDeleted && costData"
              :cost-data="costData"
              :columns="visibleColumns"
              :order-month="month"
              :pending-changes="allPendingChanges.filter(p => p.targetCollection === 'costs')"
              @save="handleCellSave"
              @pending-created="handlePendingCreated"
            />
          </tbody>
        </table>
      </div>
    </div>

    <!-- Pagination placeholder -->
    <div v-if="orders.length >= 50" class="mt-4 flex justify-center">
      <p class="text-sm text-gray-500">
        Showing first 50 rows. Scroll for more or use filters.
      </p>
    </div>
  </div>
</template>

<style scoped>
.spreadsheet-grid {
  @apply w-full;
}

/* Ensure table cells have consistent sizing */
:deep(table) {
  table-layout: auto;
}

:deep(th),
:deep(td) {
  min-width: 100px;
}

:deep(th:first-child),
:deep(td:first-child) {
  min-width: 60px;
  max-width: 80px;
}

:deep(th:nth-child(2)),
:deep(td:nth-child(2)) {
  min-width: 80px;
  max-width: 100px;
}

:deep(th:last-child),
:deep(td:last-child) {
  min-width: 80px;
  max-width: 100px;
}
</style>
