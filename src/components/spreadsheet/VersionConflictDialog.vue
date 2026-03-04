<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  field: {
    type: String,
    required: true,
  },
  fieldLabel: {
    type: String,
    default: '',
  },
  yourValue: {
    type: [String, Number, null],
    default: null,
  },
  serverValue: {
    type: [String, Number, null],
    default: null,
  },
  baseValue: {
    type: [String, Number, null],
    default: null,
  },
  yourVersion: {
    type: Number,
    default: 1,
  },
  serverVersion: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['use-yours', 'use-server', 'cancel'])

const selectedOption = ref('yours')

function handleConfirm() {
  if (selectedOption.value === 'yours') {
    emit('use-yours', {
      field: props.field,
      value: props.yourValue,
      serverVersion: props.serverVersion,
    })
  } else {
    emit('use-server', {
      field: props.field,
      value: props.serverValue,
    })
  }
}

function handleCancel() {
  emit('cancel')
}

// Format value for display
function formatValue(value) {
  if (value === null || value === undefined) return '(empty)'
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black bg-opacity-50"
        @click="handleCancel"
      />

      <!-- Dialog -->
      <div class="relative bg-white rounded-xl shadow-xl max-w-lg w-full p-6 z-10">
        <!-- Header -->
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <svg class="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900">Version Conflict</h3>
            <p class="text-sm text-gray-500">
              Field: <span class="font-medium">{{ fieldLabel || field }}</span>
            </p>
          </div>
        </div>

        <!-- Explanation -->
        <div class="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p class="text-sm text-amber-800">
            This field was modified by another user while you were editing.
            Your version: <strong>v{{ yourVersion }}</strong> → 
            Server version: <strong>v{{ serverVersion }}</strong>
          </p>
        </div>

        <!-- Comparison -->
        <div class="mb-6 space-y-3">
          <!-- Your value -->
          <label
            class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
            :class="selectedOption === 'yours' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'"
          >
            <input
              v-model="selectedOption"
              type="radio"
              value="yours"
              class="mt-1 text-blue-600 focus:ring-blue-500"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900">Use your value</span>
                <span class="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">Your edit</span>
              </div>
              <p class="mt-1 text-sm text-gray-600 font-mono">
                {{ formatValue(yourValue) }}
              </p>
            </div>
          </label>

          <!-- Server value -->
          <label
            class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors"
            :class="selectedOption === 'server' ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:bg-gray-50'"
          >
            <input
              v-model="selectedOption"
              type="radio"
              value="server"
              class="mt-1 text-green-600 focus:ring-green-500"
            />
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900">Use server value</span>
                <span class="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">Latest</span>
              </div>
              <p class="mt-1 text-sm text-gray-600 font-mono">
                {{ formatValue(serverValue) }}
              </p>
            </div>
          </label>

          <!-- Base value (for reference) -->
          <div v-if="baseValue !== yourValue && baseValue !== serverValue" class="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div class="text-xs text-gray-500 mb-1">Original value (before edits):</div>
            <p class="text-sm text-gray-600 font-mono">
              {{ formatValue(baseValue) }}
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3">
          <button
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            @click="handleConfirm"
            class="px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2"
            :class="selectedOption === 'yours' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'"
          >
            {{ selectedOption === 'yours' ? 'Use My Value' : 'Use Server Value' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
