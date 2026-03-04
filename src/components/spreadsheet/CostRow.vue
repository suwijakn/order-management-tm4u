<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import SpreadsheetCell from './SpreadsheetCell.vue'

const props = defineProps({
  costData: {
    type: Object,
    default: () => ({}),
  },
  columns: {
    type: Array,
    required: true,
  },
  orderMonth: {
    type: String,
    required: true,
  },
  pendingChanges: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['save', 'pending-created'])

const authStore = useAuthStore()

// Only Manager and Super Admin can see/edit cost row (T-AUTHZ-005)
const canViewCosts = computed(() => {
  return ['manager', 'super_admin'].includes(authStore.userRole)
})

// Get pending change for a specific field
function getPendingForField(field) {
  return props.pendingChanges.find(
    p => p.field === field && p.status === 'pending'
  ) || null
}

// Check if field is locked by another user's pending
function isFieldLocked(field) {
  const pending = getPendingForField(field)
  if (!pending) return false
  return pending.requestedBy !== authStore.user?.uid
}

// Get the name of who locked the field
function getLockedBy(field) {
  const pending = getPendingForField(field)
  return pending?.requestedByName || null
}

// Get value for a column from cost data
function getCostValue(columnKey) {
  // Cost data might have values in dynamic_fields or directly
  if (props.costData.dynamic_fields?.[columnKey] !== undefined) {
    return props.costData.dynamic_fields[columnKey]
  }
  return props.costData[columnKey] ?? null
}

// Handle cell save
function handleCellSave(payload) {
  emit('save', {
    ...payload,
    costId: props.costData.id,
  })
}

// Handle pending created
function handlePendingCreated(payload) {
  emit('pending-created', {
    ...payload,
    costId: props.costData.id,
  })
}
</script>

<template>
  <tr
    v-if="canViewCosts"
    class="bg-purple-50 border-t-2 border-purple-200"
  >
    <!-- Cost label column -->
    <td class="py-2 px-3 font-semibold text-purple-700 whitespace-nowrap sticky left-0 bg-purple-50 z-10">
      <div class="flex items-center gap-2">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clip-rule="evenodd"/>
        </svg>
        <span>Cost</span>
      </div>
    </td>

    <!-- ID column placeholder -->
    <td class="py-2 px-3 text-xs text-purple-400 font-mono">
      {{ costData.id ? costData.id.slice(0, 8) + '…' : '—' }}
    </td>

    <!-- Dynamic columns -->
    <td
      v-for="col in columns"
      :key="col.key"
      class="p-0"
    >
      <SpreadsheetCell
        :value="getCostValue(col.key)"
        :column-key="col.key"
        :column-type="col.type || 'text'"
        :column-options="col.options || []"
        :order-id="costData.id || ''"
        :order-version="costData.version || 1"
        :order-month="orderMonth"
        :is-editable="true"
        :requires-approval="false"
        :pending-change="getPendingForField(col.key)"
        :is-locked="isFieldLocked(col.key)"
        :locked-by="getLockedBy(col.key)"
        :is-cost-row="true"
        @save="handleCellSave"
        @pending-created="handlePendingCreated"
      />
    </td>

    <!-- Actions column placeholder -->
    <td class="py-2 px-3">
      <!-- No actions for cost row -->
    </td>
  </tr>
</template>
