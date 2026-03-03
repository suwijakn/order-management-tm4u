<script setup>
defineProps({
  type: {
    type: String,
    default: 'text', // 'text' | 'card' | 'table' | 'avatar' | 'button'
  },
  lines: {
    type: Number,
    default: 3,
  },
  width: {
    type: String,
    default: 'full', // 'full' | 'half' | 'third' | 'quarter' | custom value
  },
})

function getWidthClass(width) {
  const widthMap = {
    full: 'w-full',
    half: 'w-1/2',
    third: 'w-1/3',
    quarter: 'w-1/4',
  }
  return widthMap[width] || width
}
</script>

<template>
  <!-- Text skeleton -->
  <div v-if="type === 'text'" class="animate-pulse space-y-2">
    <div
      v-for="i in lines"
      :key="i"
      class="h-4 bg-gray-200 rounded"
      :class="[
        i === lines ? 'w-3/4' : getWidthClass(width),
      ]"
    ></div>
  </div>

  <!-- Card skeleton -->
  <div v-else-if="type === 'card'" class="animate-pulse">
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <div class="h-4 bg-gray-200 rounded w-1/4"></div>
      <div class="h-8 bg-gray-200 rounded w-1/2"></div>
    </div>
  </div>

  <!-- Table skeleton -->
  <div v-else-if="type === 'table'" class="animate-pulse">
    <!-- Header -->
    <div class="flex space-x-4 pb-4 border-b">
      <div class="h-4 bg-gray-200 rounded w-20"></div>
      <div class="h-4 bg-gray-200 rounded w-32"></div>
      <div class="h-4 bg-gray-200 rounded w-24"></div>
      <div class="h-4 bg-gray-200 rounded w-28"></div>
    </div>
    <!-- Rows -->
    <div v-for="i in lines" :key="i" class="flex space-x-4 py-4 border-b">
      <div class="h-4 bg-gray-200 rounded w-20"></div>
      <div class="h-4 bg-gray-200 rounded w-32"></div>
      <div class="h-4 bg-gray-200 rounded w-24"></div>
      <div class="h-4 bg-gray-200 rounded w-28"></div>
    </div>
  </div>

  <!-- Avatar skeleton -->
  <div v-else-if="type === 'avatar'" class="animate-pulse flex items-center space-x-3">
    <div class="h-10 w-10 bg-gray-200 rounded-full"></div>
    <div class="space-y-2">
      <div class="h-4 bg-gray-200 rounded w-24"></div>
      <div class="h-3 bg-gray-200 rounded w-16"></div>
    </div>
  </div>

  <!-- Button skeleton -->
  <div v-else-if="type === 'button'" class="animate-pulse">
    <div class="h-10 bg-gray-200 rounded-md w-24"></div>
  </div>

  <!-- Stat card skeleton -->
  <div v-else-if="type === 'stat'" class="animate-pulse">
    <div class="bg-white rounded-lg shadow p-6">
      <div class="h-3 bg-gray-200 rounded w-20 mb-3"></div>
      <div class="h-8 bg-gray-200 rounded w-16"></div>
    </div>
  </div>

  <!-- Sidebar skeleton -->
  <div v-else-if="type === 'sidebar'" class="animate-pulse space-y-4 p-4">
    <div v-for="i in lines" :key="i" class="flex items-center space-x-3">
      <div class="h-5 w-5 bg-gray-200 rounded"></div>
      <div class="h-4 bg-gray-200 rounded w-24"></div>
    </div>
  </div>
</template>
