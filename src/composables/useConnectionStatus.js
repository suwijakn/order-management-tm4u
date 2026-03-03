import { ref, onMounted, onUnmounted } from 'vue'
import { db } from '@/services/firebase'
import { enableNetwork, disableNetwork } from 'firebase/firestore'

/**
 * Connection status composable for monitoring Firestore connection (T-AVAIL-001)
 * Provides:
 * - Real-time connection status (connected, reconnecting, offline)
 * - Auto-reconnect with exponential backoff
 * - Manual reconnect trigger
 */
export function useConnectionStatus() {
  const status = ref('connected') // 'connected' | 'reconnecting' | 'offline'
  const lastConnected = ref(null)
  const reconnectAttempts = ref(0)
  const maxReconnectAttempts = 10
  const baseDelay = 1000 // 1 second
  const maxDelay = 30000 // 30 seconds

  let reconnectTimeout = null
  let onlineHandler = null
  let offlineHandler = null

  // Calculate exponential backoff delay
  function getBackoffDelay() {
    const delay = Math.min(
      baseDelay * Math.pow(2, reconnectAttempts.value),
      maxDelay
    )
    // Add jitter (±20%)
    const jitter = delay * 0.2 * (Math.random() - 0.5)
    return Math.round(delay + jitter)
  }

  // Attempt to reconnect to Firestore
  async function attemptReconnect() {
    if (status.value === 'connected') return

    status.value = 'reconnecting'
    reconnectAttempts.value++

    console.log(`[Connection] Reconnect attempt ${reconnectAttempts.value}/${maxReconnectAttempts}`)

    try {
      // Re-enable Firestore network
      await enableNetwork(db)
      
      // If we get here, connection is restored
      status.value = 'connected'
      lastConnected.value = new Date()
      reconnectAttempts.value = 0
      console.log('[Connection] Reconnected successfully')
    } catch (error) {
      console.error('[Connection] Reconnect failed:', error)
      
      if (reconnectAttempts.value < maxReconnectAttempts) {
        const delay = getBackoffDelay()
        console.log(`[Connection] Retrying in ${delay}ms`)
        reconnectTimeout = setTimeout(attemptReconnect, delay)
      } else {
        status.value = 'offline'
        console.error('[Connection] Max reconnect attempts reached')
      }
    }
  }

  // Handle browser online event
  function handleOnline() {
    console.log('[Connection] Browser online event')
    if (status.value !== 'connected') {
      reconnectAttempts.value = 0
      attemptReconnect()
    }
  }

  // Handle browser offline event
  function handleOffline() {
    console.log('[Connection] Browser offline event')
    status.value = 'offline'
    
    // Clear any pending reconnect
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
  }

  // Manual reconnect trigger
  async function reconnect() {
    reconnectAttempts.value = 0
    await attemptReconnect()
  }

  // Force offline (for testing)
  async function goOffline() {
    try {
      await disableNetwork(db)
      status.value = 'offline'
      console.log('[Connection] Manually disconnected')
    } catch (error) {
      console.error('[Connection] Failed to go offline:', error)
    }
  }

  // Force online (for testing)
  async function goOnline() {
    try {
      await enableNetwork(db)
      status.value = 'connected'
      lastConnected.value = new Date()
      console.log('[Connection] Manually connected')
    } catch (error) {
      console.error('[Connection] Failed to go online:', error)
    }
  }

  onMounted(() => {
    // Set initial status
    status.value = navigator.onLine ? 'connected' : 'offline'
    if (status.value === 'connected') {
      lastConnected.value = new Date()
    }

    // Listen for browser online/offline events
    onlineHandler = handleOnline
    offlineHandler = handleOffline
    window.addEventListener('online', onlineHandler)
    window.addEventListener('offline', offlineHandler)
  })

  onUnmounted(() => {
    // Cleanup
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }
    if (onlineHandler) {
      window.removeEventListener('online', onlineHandler)
    }
    if (offlineHandler) {
      window.removeEventListener('offline', offlineHandler)
    }
  })

  return {
    status,
    lastConnected,
    reconnectAttempts,
    reconnect,
    goOffline,
    goOnline,
  }
}
