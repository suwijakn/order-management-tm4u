<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['add'])

const authStore = useAuthStore()

// Only Manager+ can add rows
const canAddRow = computed(() => {
  return ['manager', 'super_admin'].includes(authStore.userRole)
})

const isAdding = ref(false)

async function handleAdd() {
  if (!canAddRow.value || props.disabled || isAdding.value) return
  
  isAdding.value = true
  try {
    emit('add')
  } finally {
    // Reset after a short delay to prevent double-clicks
    setTimeout(() => {
      isAdding.value = false
    }, 500)
  }
}
</script>

<template>
  <button
    v-if="canAddRow"
    @click="handleAdd"
    :disabled="disabled || isAdding"
    class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
  >
    <svg
      v-if="isAdding"
      class="w-4 h-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
    </svg>
    <svg
      v-else
      class="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
    </svg>
    <span>Add Row</span>
  </button>
</template>
