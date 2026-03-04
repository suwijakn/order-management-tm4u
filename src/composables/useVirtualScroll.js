import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

/**
 * Virtual scrolling composable for efficient rendering of large lists.
 * Only renders items that are visible in the viewport plus a buffer.
 * 
 * @param {Object} options - Configuration options
 * @param {Ref<Array>} options.items - Reactive array of items to virtualize
 * @param {number} options.itemHeight - Height of each item in pixels (default: 40)
 * @param {number} options.containerHeight - Height of the scrollable container (default: 500)
 * @param {number} options.buffer - Number of extra items to render above/below viewport (default: 5)
 */
export function useVirtualScroll(options = {}) {
  const {
    items = ref([]),
    itemHeight = 40,
    containerHeight = 500,
    buffer = 5,
  } = options

  const scrollTop = ref(0)
  const containerRef = ref(null)

  // Calculate visible range
  const visibleCount = computed(() => {
    return Math.ceil(containerHeight / itemHeight) + buffer * 2
  })

  const startIndex = computed(() => {
    const start = Math.floor(scrollTop.value / itemHeight) - buffer
    return Math.max(0, start)
  })

  const endIndex = computed(() => {
    const end = startIndex.value + visibleCount.value
    return Math.min(items.value.length, end)
  })

  // Visible items slice
  const visibleItems = computed(() => {
    return items.value.slice(startIndex.value, endIndex.value)
  })

  // Total height for scroll area
  const totalHeight = computed(() => {
    return items.value.length * itemHeight
  })

  // Offset for positioning visible items
  const offsetY = computed(() => {
    return startIndex.value * itemHeight
  })

  // Handle scroll event
  function handleScroll(event) {
    scrollTop.value = event.target.scrollTop
  }

  // Scroll to specific index
  function scrollToIndex(index) {
    if (containerRef.value) {
      containerRef.value.scrollTop = index * itemHeight
    }
  }

  // Scroll to top
  function scrollToTop() {
    scrollToIndex(0)
  }

  // Scroll to bottom
  function scrollToBottom() {
    scrollToIndex(items.value.length - 1)
  }

  // Setup scroll listener
  onMounted(() => {
    if (containerRef.value) {
      containerRef.value.addEventListener('scroll', handleScroll, { passive: true })
    }
  })

  onUnmounted(() => {
    if (containerRef.value) {
      containerRef.value.removeEventListener('scroll', handleScroll)
    }
  })

  // Watch for container ref changes
  watch(containerRef, (newRef, oldRef) => {
    if (oldRef) {
      oldRef.removeEventListener('scroll', handleScroll)
    }
    if (newRef) {
      newRef.addEventListener('scroll', handleScroll, { passive: true })
    }
  })

  return {
    containerRef,
    visibleItems,
    totalHeight,
    offsetY,
    startIndex,
    endIndex,
    scrollToIndex,
    scrollToTop,
    scrollToBottom,
    handleScroll,
  }
}

/**
 * Simple pagination composable for paginating arrays.
 * 
 * @param {Object} options - Configuration options
 * @param {Ref<Array>} options.items - Reactive array of items to paginate
 * @param {number} options.pageSize - Number of items per page (default: 50)
 */
export function usePagination(options = {}) {
  const {
    items = ref([]),
    pageSize = 50,
  } = options

  const currentPage = ref(1)

  const totalPages = computed(() => {
    return Math.ceil(items.value.length / pageSize)
  })

  const totalItems = computed(() => items.value.length)

  const startIndex = computed(() => {
    return (currentPage.value - 1) * pageSize
  })

  const endIndex = computed(() => {
    return Math.min(startIndex.value + pageSize, items.value.length)
  })

  const paginatedItems = computed(() => {
    return items.value.slice(startIndex.value, endIndex.value)
  })

  const hasNextPage = computed(() => currentPage.value < totalPages.value)
  const hasPrevPage = computed(() => currentPage.value > 1)

  function nextPage() {
    if (hasNextPage.value) {
      currentPage.value++
    }
  }

  function prevPage() {
    if (hasPrevPage.value) {
      currentPage.value--
    }
  }

  function goToPage(page) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  function goToFirst() {
    currentPage.value = 1
  }

  function goToLast() {
    currentPage.value = totalPages.value
  }

  // Reset to page 1 when items change significantly
  watch(() => items.value.length, (newLen, oldLen) => {
    if (currentPage.value > Math.ceil(newLen / pageSize)) {
      currentPage.value = Math.max(1, Math.ceil(newLen / pageSize))
    }
  })

  return {
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedItems,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    goToFirst,
    goToLast,
    startIndex,
    endIndex,
  }
}
