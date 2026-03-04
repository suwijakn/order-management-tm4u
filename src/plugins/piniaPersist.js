/**
 * Simple Pinia persistence plugin using localStorage.
 * Persists specified stores to localStorage and rehydrates on page load.
 */

const STORAGE_PREFIX = 'tm4u_'

/**
 * Create a persistence plugin for Pinia.
 * @param {Object} options - Configuration options
 * @param {string[]} options.stores - Array of store IDs to persist
 * @param {string[]} options.paths - Array of state paths to persist (e.g., ['orders', 'currentMonth'])
 */
export function createPersistPlugin(options = {}) {
  const { stores = [], paths = [] } = options

  return ({ store }) => {
    // Only persist specified stores
    if (stores.length > 0 && !stores.includes(store.$id)) {
      return
    }

    const storageKey = `${STORAGE_PREFIX}${store.$id}`

    // Rehydrate from localStorage on store creation
    const savedState = localStorage.getItem(storageKey)
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState)
        // Only restore specified paths, or all if no paths specified
        if (paths.length > 0) {
          const filteredState = {}
          for (const path of paths) {
            if (parsed[path] !== undefined) {
              filteredState[path] = parsed[path]
            }
          }
          store.$patch(filteredState)
        } else {
          store.$patch(parsed)
        }
        console.log(`[piniaPersist] Restored ${store.$id} from localStorage`)
      } catch (err) {
        console.warn(`[piniaPersist] Failed to restore ${store.$id}:`, err)
        localStorage.removeItem(storageKey)
      }
    }

    // Subscribe to state changes and persist
    store.$subscribe(
      (mutation, state) => {
        try {
          // Only persist specified paths, or all if no paths specified
          let stateToPersist = state
          if (paths.length > 0) {
            stateToPersist = {}
            for (const path of paths) {
              if (state[path] !== undefined) {
                stateToPersist[path] = state[path]
              }
            }
          }
          localStorage.setItem(storageKey, JSON.stringify(stateToPersist))
        } catch (err) {
          console.warn(`[piniaPersist] Failed to persist ${store.$id}:`, err)
        }
      },
      { detached: true }
    )
  }
}

/**
 * Clear all persisted Pinia state from localStorage.
 */
export function clearPersistedState() {
  const keys = Object.keys(localStorage)
  for (const key of keys) {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key)
    }
  }
  console.log('[piniaPersist] Cleared all persisted state')
}

/**
 * Clear persisted state for a specific store.
 * @param {string} storeId - The store ID to clear
 */
export function clearStoreState(storeId) {
  localStorage.removeItem(`${STORAGE_PREFIX}${storeId}`)
  console.log(`[piniaPersist] Cleared persisted state for ${storeId}`)
}
