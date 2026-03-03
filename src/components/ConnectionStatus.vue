<script setup>
import { useConnectionStatus } from '@/composables/useConnectionStatus'

const { status, reconnect, reconnectAttempts } = useConnectionStatus()

const statusConfig = {
  connected: {
    color: 'bg-green-500',
    text: 'Connected',
    icon: 'check',
  },
  reconnecting: {
    color: 'bg-yellow-500',
    text: 'Reconnecting...',
    icon: 'refresh',
  },
  offline: {
    color: 'bg-red-500',
    text: 'Offline',
    icon: 'x',
  },
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Status indicator dot -->
    <div class="relative flex items-center">
      <span
        class="h-2.5 w-2.5 rounded-full"
        :class="statusConfig[status].color"
      ></span>
      <!-- Pulse animation for reconnecting -->
      <span
        v-if="status === 'reconnecting'"
        class="absolute h-2.5 w-2.5 rounded-full animate-ping"
        :class="statusConfig[status].color"
      ></span>
    </div>

    <!-- Status text (hidden on mobile) -->
    <span class="hidden sm:inline text-xs text-gray-500">
      {{ statusConfig[status].text }}
      <span v-if="status === 'reconnecting'" class="text-gray-400">
        ({{ reconnectAttempts }})
      </span>
    </span>

    <!-- Reconnect button (only shown when offline) -->
    <button
      v-if="status === 'offline'"
      @click="reconnect"
      class="text-xs text-blue-600 hover:text-blue-800 underline"
    >
      Retry
    </button>
  </div>
</template>
