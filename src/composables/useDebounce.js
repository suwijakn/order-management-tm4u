import { ref, watch } from 'vue'

/**
 * Debounce a value with a specified delay.
 * @param {Ref} value - The reactive value to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Ref} - Debounced value
 */
export function useDebouncedRef(initialValue, delay = 300) {
  const value = ref(initialValue)
  const debouncedValue = ref(initialValue)
  let timeout = null

  watch(value, (newValue) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  })

  return {
    value,
    debouncedValue,
    flush: () => {
      if (timeout) {
        clearTimeout(timeout)
        debouncedValue.value = value.value
      }
    },
    cancel: () => {
      if (timeout) {
        clearTimeout(timeout)
      }
    }
  }
}

/**
 * Create a debounced function.
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds (default: 300ms)
 * @returns {Function} - Debounced function with cancel method
 */
export function useDebounce(fn, delay = 300) {
  let timeout = null

  const debouncedFn = (...args) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn(...args)
    }, delay)
  }

  debouncedFn.cancel = () => {
    if (timeout) {
      clearTimeout(timeout)
    }
  }

  debouncedFn.flush = (...args) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    fn(...args)
  }

  return debouncedFn
}
