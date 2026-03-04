<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  orderId: {
    type: String,
    required: true,
  },
  orderLabel: {
    type: String,
    default: '',
  },
  hasPendingChanges: {
    type: Boolean,
    default: false,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['confirm', 'cancel', 'recover', 'permanent-delete'])

const authStore = useAuthStore()

// Only Manager+ can delete/recover rows
const canManageRows = computed(() => {
  return ['manager', 'super_admin'].includes(authStore.userRole)
})

const isOpen = ref(false)
const isProcessing = ref(false)
const forceDelete = ref(false)
const confirmPermanent = ref(false)

// Open the confirmation dialog
function open() {
  if (!canManageRows.value) return
  isOpen.value = true
  forceDelete.value = false
  confirmPermanent.value = false
}

// Close the dialog
function close() {
  isOpen.value = false
  forceDelete.value = false
  confirmPermanent.value = false
  emit('cancel')
}

// Confirm soft delete
async function confirmDelete() {
  if (props.hasPendingChanges && !forceDelete.value) {
    // Show force delete option
    return
  }

  isProcessing.value = true
  try {
    emit('confirm', {
      orderId: props.orderId,
      forceDelete: forceDelete.value,
    })
    close()
  } finally {
    isProcessing.value = false
  }
}

// Recover deleted order
async function recoverOrder() {
  isProcessing.value = true
  try {
    emit('recover', { orderId: props.orderId })
    close()
  } finally {
    isProcessing.value = false
  }
}

// Permanent delete (Super Admin only, with confirmation)
async function permanentDelete() {
  if (!confirmPermanent.value) {
    confirmPermanent.value = true
    return
  }

  isProcessing.value = true
  try {
    emit('permanent-delete', { orderId: props.orderId })
    close()
  } finally {
    isProcessing.value = false
  }
}

// Expose open method for parent
defineExpose({ open })
</script>

<template>
  <!-- Delete/Recover button -->
  <div v-if="canManageRows" class="inline-flex gap-1">
    <!-- For active orders: Delete button -->
    <button
      v-if="!isDeleted"
      @click="open"
      class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
      title="Delete order"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
      </svg>
    </button>

    <!-- For deleted orders: Recover button -->
    <button
      v-if="isDeleted"
      @click="recoverOrder"
      :disabled="isProcessing"
      class="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
      title="Recover order"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
    </button>

    <!-- For deleted orders: Permanent delete (Super Admin only) -->
    <button
      v-if="isDeleted && authStore.userRole === 'super_admin'"
      @click="open"
      :disabled="isProcessing"
      class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
      title="Permanently delete"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
      </svg>
    </button>
  </div>

  <!-- Confirmation Modal -->
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black bg-opacity-50"
        @click="close"
      />

      <!-- Modal -->
      <div class="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 z-10">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
          <div
            :class="[
              'w-10 h-10 rounded-full flex items-center justify-center',
              isDeleted ? 'bg-red-100' : 'bg-yellow-100'
            ]"
          >
            <svg
              class="w-5 h-5"
              :class="isDeleted ? 'text-red-600' : 'text-yellow-600'"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              {{ isDeleted ? 'Permanently Delete Order?' : 'Delete Order?' }}
            </h3>
            <p class="text-sm text-gray-500">
              {{ orderLabel || orderId }}
            </p>
          </div>
        </div>

        <!-- Content -->
        <div class="mb-6">
          <!-- Soft delete warning -->
          <template v-if="!isDeleted">
            <p class="text-gray-600 mb-3">
              This order will be soft-deleted and can be recovered within 30 days.
            </p>

            <!-- Pending changes warning -->
            <div
              v-if="hasPendingChanges"
              class="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3"
            >
              <div class="flex items-start gap-2">
                <svg class="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <div>
                  <p class="text-sm font-medium text-amber-800">
                    This order has pending changes
                  </p>
                  <p class="text-sm text-amber-700 mt-1">
                    Deleting will void all pending changes for this order.
                  </p>
                  <label class="flex items-center gap-2 mt-2">
                    <input
                      v-model="forceDelete"
                      type="checkbox"
                      class="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                    />
                    <span class="text-sm text-amber-800">
                      I understand, delete anyway
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </template>

          <!-- Permanent delete warning -->
          <template v-else>
            <div class="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p class="text-sm text-red-700 font-medium mb-2">
                ⚠️ This action cannot be undone!
              </p>
              <p class="text-sm text-red-600">
                The order and all associated data will be permanently removed from the system.
              </p>
              <label v-if="!confirmPermanent" class="flex items-center gap-2 mt-3">
                <input
                  v-model="confirmPermanent"
                  type="checkbox"
                  class="rounded border-red-300 text-red-600 focus:ring-red-500"
                />
                <span class="text-sm text-red-800">
                  I understand this is permanent
                </span>
              </label>
            </div>
          </template>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="close"
            :disabled="isProcessing"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            v-if="!isDeleted"
            @click="confirmDelete"
            :disabled="isProcessing || (hasPendingChanges && !forceDelete)"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isProcessing">Deleting...</span>
            <span v-else>Delete Order</span>
          </button>

          <button
            v-else
            @click="permanentDelete"
            :disabled="isProcessing || !confirmPermanent"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isProcessing">Deleting...</span>
            <span v-else>Permanently Delete</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
